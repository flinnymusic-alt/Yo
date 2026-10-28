#!/usr/bin/env python3
"""Build the mat-rack bracket with OpenSCAD and verify it.

Every check is a hard pass/fail rule. Run:  python3 check_model.py
Needs: openscad, python3 with trimesh + manifold3d + numpy,
optional prusa-slicer (for the real slicing check).
"""
import math
import os
import re
import shutil
import subprocess
import sys

import numpy as np
import trimesh

HERE = os.path.dirname(os.path.abspath(__file__))
SCAD = os.path.join(HERE, "mat_rack_bracket.scad")
OUT = os.path.join(HERE, "out")
PRINT_STL = os.path.join(OUT, "mat_rack_bracket.stl")
USE_STL = os.path.join(OUT, "mat_rack_bracket_use_orientation.stl")

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f"  ({detail})" if detail else ""))


def build(path, orient):
    proc = subprocess.run(
        ["openscad", "-D", f'orient="{orient}"', "-o", path, SCAD],
        capture_output=True, text=True)
    log = proc.stdout + proc.stderr
    if proc.returncode != 0 or "ERROR" in log or "WARNING" in log:
        print(log)
        sys.exit(f"OpenSCAD build failed for orient={orient}")
    return {k: float(v) for k, v in re.findall(r'PARAM (\w+)=([-\d.e]+)', log)}


def main():
    os.makedirs(OUT, exist_ok=True)
    P = build(PRINT_STL, "print")
    build(USE_STL, "use")
    check("OpenSCAD builds with no errors/warnings and all design asserts pass", True)

    m = trimesh.load(PRINT_STL)
    u = trimesh.load(USE_STL)

    # ---- 1. mesh integrity ------------------------------------------
    check("Mesh is watertight (closed solid)", m.is_watertight)
    check("Face winding is consistent", m.is_winding_consistent)
    check("Mesh is a single body", len(m.split(only_watertight=False)) == 1,
          f"{len(m.split(only_watertight=False))} bodies")
    check("Volume is positive (normals point outward)", m.volume > 0,
          f"{m.volume / 1000:.1f} cm^3")
    check("Print and use orientations have identical volume",
          abs(m.volume - u.volume) < 1e-3 * m.volume)

    # ---- 2. size / bed fit ------------------------------------------
    ext = m.bounds[1] - m.bounds[0]
    exp = np.array([P["back_height"], P["y_out"], P["width"]])
    check("Bounding box matches the design", np.allclose(ext, exp, atol=0.05),
          f"{ext.round(2)} vs {exp.round(2)} mm")
    check("Sits on the bed at Z=0", abs(m.bounds[0][2]) < 1e-6)
    check("Fits a 180x180x180 bed (Prusa Mini, smallest common)",
          all(ext <= 180), f"{ext.round(1)}")

    # ---- 3. bed contact & tip-over while printing --------------------
    bottom = m.section(plane_origin=[0, 0, 0.01], plane_normal=[0, 0, 1])
    poly, _ = bottom.to_2D()
    area = poly.area
    check("First layer contact area is large (>=600 mm^2)", area >= 600,
          f"{area:.0f} mm^2")
    com = m.center_mass[:2]
    from shapely.geometry import MultiPoint, Point
    fp = MultiPoint([tuple(v[:2]) for v in bottom.vertices]).convex_hull
    margin = fp.exterior.distance(Point(com)) if fp.contains(Point(com)) else -1
    check("Centre of mass is well inside the footprint (no tipping)",
          margin > 5, f"{margin:.1f} mm from edge")

    # ---- 4. overhangs in print orientation ---------------------------
    n = m.face_normals
    a = m.area_faces
    z_face = m.triangles[:, :, 2].mean(axis=1)
    down = (n[:, 2] < -math.cos(math.radians(45)) - 1e-3) & (z_face > 0.05)
    check("No overhang steeper than 45 deg (no supports needed)",
          a[down].sum() < 1.0, f"{a[down].sum():.2f} mm^2 over 45 deg")

    # ---- 5. minimum wall thickness (ray casting) ---------------------
    pts, fidx = trimesh.sample.sample_surface_even(m, 4000, seed=1)
    dirs = -m.face_normals[fidx]
    origins = pts + dirs * 1e-3
    locs, ray_i, _ = m.ray.intersects_location(origins, dirs, multiple_hits=False)
    th = np.full(len(pts), np.inf)
    th[ray_i] = np.linalg.norm(locs - origins[ray_i], axis=1)
    # ignore glancing samples on rounded edges (tangent rays)
    tmin = np.percentile(th[np.isfinite(th)], 0.5)
    check("Thinnest wall >= 2.4 mm (6 lines @0.4)", tmin >= 2.4, f"{tmin:.2f} mm")

    # ---- 6. functional test: do real mats fit and lean back? ---------
    t, k = P["mat_thickness"], int(P["mat_count"])
    yin, zf, slope = P["y_in"], P["z_front"], math.radians(P["floor_slope"])
    W = P["width"]
    worst_angle = 90

    def mat_stack(H, lift):
        nonlocal worst_angle
        mats = []
        for i in range(k):                         # i=0 front-most
            yb = yin - 0.15 - (i + 0.5) * t        # bottoms slid to the lip
            zb = zf + (yin - yb) * math.tan(slope) + lift
            yt = (k - 1 - i + 0.5) * t             # tops stacked on the wall
            L = math.hypot(yb - yt, H - zb)
            ang = math.atan2(yb - yt, H - zb)       # lean back from vertical
            worst_angle = min(worst_angle, math.degrees(ang))
            box = trimesh.creation.box([W + 60, t - 0.1, L])
            T = trimesh.transformations.rotation_matrix(ang, [1, 0, 0])
            T[:3, 3] = [W / 2, (yb + yt) / 2, (zb + H) / 2]
            box.apply_transform(T)
            mats.append(box)
        return trimesh.util.concatenate(mats)

    for H in (150, 200, 250, 300, 380):           # mat heights to try
        # lower the stack until it rests without passing through the part
        rest = None
        for lift in np.arange(0.1, 6.01, 0.1):
            clash = trimesh.boolean.intersection([u, mat_stack(H, lift)],
                                                 engine="manifold")
            if clash.is_empty or clash.volume < 1e-3:
                rest = lift
                break
        check(f"{k} x {t} mm mats, {H} mm tall, settle in with no collision",
              rest is not None and rest <= 3.0,
              f"rests {rest:.1f} mm above the floor line" if rest else "never fits")
    check("Every mat leans back >= 3 deg (gravity holds it to the wall)",
          worst_angle >= 3, f"min lean {worst_angle:.1f} deg")
    retain = P["z_lip"] - P["z_front"]
    check("Lip catches >= 40 mm of the mat bottom", retain >= 40, f"{retain:.0f} mm")
    rear_y = yin - k * t
    check("Full stack fits in pocket with room for fingers (>=6 mm)",
          rear_y - P["back_wall"] >= 6, f"{rear_y - P['back_wall']:.1f} mm spare")

    # ---- 7. drainage --------------------------------------------------
    # floor must fall toward the lip and the weep holes must reach the floor
    check("Floor falls toward the weep holes", P["z_back"] > P["z_front"] + 1,
          f"drop {P['z_back'] - P['z_front']:.2f} mm")
    hits = 0
    pitch = W / P["weep_count"]
    for i in range(int(P["weep_count"])):
        x = pitch * (i + 0.5)
        o = np.array([[x, yin - 1, zf + 0.5]])
        d = np.array([[0, 1, 0]])
        hits += len(u.ray.intersects_location(o, d)[0]) == 0
    check("Water at floor level escapes through every weep hole",
          hits == P["weep_count"], f"{hits}/{int(P['weep_count'])} open")

    # ---- 8. screw access --------------------------------------------
    ok = True
    for s in (-1, 1):
        x = W / 2 + s * P["screw_spacing"] / 2
        o = np.array([[x, 200, P["screw_z"]]])
        d = np.array([[0, -1, 0]])
        ok &= len(u.ray.intersects_location(o, d)[0]) == 0
    check("Screwdriver has a straight line through both holes to the wall", ok)

    # ---- 9. strength (hand calc, PETG yield ~45 MPa, E ~2.0 GPa) -------
    F = 20.0                                         # N, someone yanking a mat
    Lh = (P["z_lip"] - P["z_front"]) / 1000
    b, h = W / 1000, P["lip_wall"] / 1000
    sigma = F * Lh / (b * h * h / 6) / 1e6
    defl = F * Lh ** 3 / (3 * 2.0e9 * b * h ** 3 / 12) * 1000
    check("Lip survives a 2 kg outward yank with safety factor >= 3",
          45 / sigma >= 3, f"stress {sigma:.1f} MPa, SF {45 / sigma:.1f}, "
          f"flex {defl:.1f} mm")
    Fm = k * 0.5 * 9.81                              # 0.5 kg per mat, all on one
    fl = (P["y_in"] - P["back_wall"]) / 1000
    sig_f = Fm * fl / (b * (P["z_front"] / 1000) ** 2 / 6) / 1e6
    check("Floor holds the whole stack on one bracket, SF >= 3",
          45 / sig_f >= 3, f"stress {sig_f:.1f} MPa, SF {45 / sig_f:.0f}")

    # ---- 10. slice with PrusaSlicer ------------------------------------
    if shutil.which("prusa-slicer"):
        gcode = os.path.join(OUT, "mat_rack_bracket_PETG_0.2mm.gcode")
        proc = subprocess.run(
            ["prusa-slicer", "--export-gcode", PRINT_STL, "--output", gcode,
             "--layer-height", "0.2", "--first-layer-height", "0.2",
             "--nozzle-diameter", "0.4", "--perimeters", "4",
             "--top-solid-layers", "5", "--bottom-solid-layers", "4",
             "--fill-density", "25%", "--fill-pattern", "gyroid",
             "--temperature", "240", "--bed-temperature", "80",
             "--filament-diameter", "1.75", "--filament-density", "1.27",
             "--bed-shape", "0x0,180x0,180x180,0x180", "--center", "90,90",
             "--no-support-material"],
            capture_output=True, text=True)
        ok = proc.returncode == 0 and os.path.exists(gcode)
        detail = ""
        if ok:
            g = open(gcode).read()
            tm = re.search(r"estimated printing time \(normal mode\) = (.+)", g)
            fg = re.search(r"filament used \[g\] = ([\d.]+)", g)
            layers = g.count(";LAYER_CHANGE")
            detail = (f"{layers} layers, {fg.group(1) if fg else '?'} g, "
                      f"{tm.group(1) if tm else '?'}")
            check("Sliced layer count matches 0.2 mm layers",
                  abs(layers - P["width"] / 0.2) <= 1, f"{layers}")
        else:
            print(proc.stdout[-2000:], proc.stderr[-2000:])
        check("PrusaSlicer slices it with supports OFF", ok, detail)
    else:
        print("[SKIP] prusa-slicer not installed")

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
