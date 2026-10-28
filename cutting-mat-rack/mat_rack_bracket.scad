// Flexible cutting-mat rack: wall / cabinet-door pocket bracket
// ---------------------------------------------------------------
// Floppy plastic cutting mats cannot stand up on their own, so this
// bracket never asks them to. It catches the bottom edge in a pocket
// whose floor slopes toward the front: the mat bottoms slide forward
// against the lip, so the tops always lean BACK onto the wall/door and
// gravity keeps them flat. Print two and stand the mats on their long
// edge across both (see README.md).
//
// Units: mm.  Use coordinates: X = along the wall, Y = out from the
// wall, Z = up.  The exported STL is rotated into print orientation
// (profile flat on the bed, no supports needed).

/* [Mats] */
mat_count      = 6;     // how many mats the pocket must hold
mat_thickness  = 2.0;   // thickest mat you own (most flexible mats: 0.5-2)

/* [Bracket] */
width          = 80;    // length along the wall = print height
pocket_gap     = 30;    // inside depth; deeper = more lean-back
lip_height     = 60;    // front lip height above the floor
lip_wall       = 3.2;   // 8 x 0.4 mm lines
back_wall      = 4.0;
back_height    = 110;   // tall enough to put the screws above the lip
floor_min      = 3.0;   // floor thickness at its thinnest (front)
floor_slope    = 8;     // degrees, falls toward the lip

/* [Drainage] */
weep_count     = 3;
weep_w         = 6;     // along the wall (vertical when printing)
weep_h         = 3;     // height above the floor (bridged when printing)

/* [Screws] */
screw_d        = 4.5;   // clearance for #8 / M4 / 4 mm wood screws
screw_head_d   = 8.5;   // 90 degree countersunk head
screw_spacing  = 44;
screw_z        = 92;

/* [Printer] */
nozzle         = 0.4;
bed_x          = 180;   // smallest common bed (Prusa Mini) -- for asserts
bed_y          = 180;
max_z          = 180;

/* [Output] */
orient         = "print"; // "print" or "use"

$fn = 64;

// ---------- derived -------------------------------------------------
y_in    = back_wall + pocket_gap;           // inner face of lip
y_out   = y_in + lip_wall;                  // overall depth
z_front = floor_min;                        // floor top at the lip
z_back  = floor_min + pocket_gap * tan(floor_slope);
z_lip   = z_front + lip_height;
r_out   = 1.2;                              // convex rounding
r_in    = 1.5;                              // concave fillet
stack   = mat_count * mat_thickness;
cs_depth = (screw_head_d - screw_d) / 2;    // 90 deg countersink

// ---------- design rules (fail the build, not the print) -----------
assert(stack + 6 <= pocket_gap,
       "pocket too shallow for the mat stack plus finger/lean room");
assert(lip_wall >= 2 * nozzle && abs(lip_wall / nozzle - round(lip_wall / nozzle)) < 1e-6,
       "lip wall must be a whole number (>=2) of nozzle widths");
assert(back_wall >= 3, "back wall too thin to hold a countersunk screw");
assert(cs_depth <= back_wall - 1.5, "countersink would leave <1.5 mm under the head");
assert(screw_z - screw_head_d / 2 >= z_lip + 5,
       "screw heads must sit above the lip so a screwdriver can reach them");
assert(screw_z + screw_head_d / 2 <= back_height - 3, "screw too close to top edge");
assert(screw_spacing / 2 + screw_head_d / 2 <= width / 2 - 4, "screws too close to the ends");
assert(floor_slope >= 5 && floor_slope <= 20, "floor slope outside 5..20 deg");
assert(r_out < lip_wall / 2, "rounding radius would eat the lip");
assert(weep_count * (weep_w + 6) <= width, "too many weep holes for this width");
assert(width <= max_z, "bracket taller than printer Z");
assert(y_out <= bed_x && back_height <= bed_y, "profile does not fit the bed");

// machine-readable values for check_model.py
echo(str("PARAM width=", width));
echo(str("PARAM y_in=", y_in));
echo(str("PARAM y_out=", y_out));
echo(str("PARAM back_wall=", back_wall));
echo(str("PARAM back_height=", back_height));
echo(str("PARAM z_front=", z_front));
echo(str("PARAM z_back=", z_back));
echo(str("PARAM z_lip=", z_lip));
echo(str("PARAM lip_wall=", lip_wall));
echo(str("PARAM floor_slope=", floor_slope));
echo(str("PARAM mat_count=", mat_count));
echo(str("PARAM mat_thickness=", mat_thickness));
echo(str("PARAM screw_z=", screw_z));
echo(str("PARAM screw_spacing=", screw_spacing));
echo(str("PARAM screw_d=", screw_d));
echo(str("PARAM weep_count=", weep_count));
echo(str("PARAM weep_w=", weep_w));
echo(str("PARAM weep_h=", weep_h));

// ---------- geometry ------------------------------------------------
// 2D side profile: x = Y (out from wall), y = Z (up)
module raw_profile() {
    polygon([
        [0,      0],
        [y_out,  0],
        [y_out,  z_lip],
        [y_in,   z_lip],
        [y_in,   z_front],
        [back_wall, z_back],
        [back_wall, back_height],
        [0,      back_height]
    ]);
}

module profile() {
    // round convex corners, then fillet the concave ones
    offset(r = -r_in) offset(delta = r_in)
        offset(r = r_out) offset(delta = -r_out)
            raw_profile();
}

// Cone with a 45 deg "teardrop" roof toward +X, axis along +Z.
// +X becomes straight up when printing, so the hole needs no support.
module teardrop_cone(h, r1, r2) {
    hull() {
        cylinder(h = h, r1 = r1, r2 = r2);
        translate([r1 * sqrt(2) - 0.01, -0.005, 0])     cube([0.01, 0.01, 0.01]);
        translate([r2 * sqrt(2) - 0.01, -0.005, h - 0.01]) cube([0.01, 0.01, 0.01]);
    }
}

module screw_hole() {
    // axis along +Y (out of the wall); countersink on the front face
    rotate([-90, 0, 0]) {
        translate([0, 0, -1]) teardrop_cone(back_wall + 2, screw_d / 2, screw_d / 2);
        translate([0, 0, back_wall - cs_depth])
            teardrop_cone(cs_depth + 0.01, screw_d / 2, screw_head_d / 2);
        // open space in front of the head so the cone is not capped
        translate([0, 0, back_wall])
            teardrop_cone(2, screw_head_d / 2, screw_head_d / 2);
    }
}

// Drain slot through the lip at floor level, pointed roof toward +X.
module weep_hole() {
    hh = weep_h + 0.4;  // dips 0.4 below the floor so no puddle is left
    translate([0, y_in - 2, z_front - 0.4])
        hull() {
            cube([weep_w, lip_wall + 4, hh]);
            // apex centred on the slot, hh/2 beyond it -> 45 deg roof
            translate([weep_w + hh / 2 - 0.01, 0, hh / 2 - 0.005])
                cube([0.01, lip_wall + 4, 0.01]);
        }
}

module bracket() {
    difference() {
        rotate([90, 0, 90]) linear_extrude(width) profile();

        for (s = [-1, 1])
            translate([width / 2 + s * screw_spacing / 2, 0, screw_z]) screw_hole();

        pitch = width / weep_count;
        for (i = [0 : weep_count - 1])
            translate([pitch * (i + 0.5) - weep_w / 2, 0, 0]) weep_hole();
    }
}

if (orient == "print")
    // use-X -> print Z (up). Profile lies on the bed.
    translate([back_height, 0, 0]) rotate([0, -90, 0]) bracket();
else
    bracket();
