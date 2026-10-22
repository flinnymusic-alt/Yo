// Free Fruit Finder front end. Plain JS, no build step.
// Map: Leaflet + OpenStreetMap tiles. Place names: OpenStreetMap Nominatim.
(() => {
  "use strict";

  const FRUITS = ["Apple", "Apricot", "Avocado", "Blackberry", "Cherry", "Feijoa", "Fig", "Grapefruit", "Guava", "Lemon",
    "Lime", "Loquat", "Mandarin", "Mango", "Mulberry", "Olive", "Orange", "Peach", "Pear", "Persimmon", "Plum",
    "Pomegranate", "Quince", "Walnut"];
  const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const UNKNOWN_CITY = "Unknown area";

  const $ = (id) => document.getElementById(id);
  const state = { trees: [], city: "", fruit: "", status: "", q: "", openId: null };
  let map, cluster, meMarker, pickMap, pickPin;
  let photo = null; // { full: Blob, thumb: Blob }
  let pinSet = false, cityEdited = false, placeEdited = false;
  let geoAbort = null, geoTimer = null;

  // ---------- small helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const tokens = () => store.get("ff-tokens", {});
  function ago(ms) {
    if (!ms) return "";
    const d = Math.floor((Date.now() - ms) / 86400000);
    if (d < 1) return "today";
    if (d === 1) return "yesterday";
    if (d < 45) return `${d} days ago`;
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  const statusPill = (t) => `<span class="status ${t.status === "yes" ? "yes" : "no"}">${t.status === "yes" ? "Fruiting" : "Not fruiting"} · ${esc(ago(t.statusAt))}</span>`;
  const cityOf = (t) => t.city || UNKNOWN_CITY;
  const directionsUrl = (t) => `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`;
  const photoUrl = (t, small) => (t.photo ? `/api/photos/${t.id}${small && t.thumb ? "-t" : ""}` : null);
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function banner(html, retry) {
    const el = $("banner");
    el.innerHTML = html + (retry ? ' <button type="button" class="btn small" id="retryBtn">Try again</button>' : "");
    el.hidden = false;
    if (retry) $("retryBtn").onclick = () => { el.hidden = true; retry(); };
  }
  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch(path, options);
    } catch {
      throw Object.assign(new Error("You seem to be offline. Check your connection and try again."), { status: 0 });
    }
    let body = {};
    try { body = await res.json(); } catch { /* empty body */ }
    if (!res.ok) throw Object.assign(new Error(body.error || `Something went wrong (${res.status}).`), { status: res.status, body });
    return body;
  }
  function distanceKm(a, b) {
    const rad = Math.PI / 180;
    const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }
  const fmtDist = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

  // ---------- geolocation ----------
  function locate() {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) return reject(new Error("Your browser can't share your location. Tap the map instead."));
      // The browser's own timeout doesn't count time spent on the permission prompt.
      const giveUp = setTimeout(() => reject(new Error("Couldn't get your location. Allow location access, or tap the map instead.")), 25000);
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(giveUp); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
        (e) => {
          clearTimeout(giveUp);
          reject(new Error(e.code === 1
            ? "Location is blocked. Allow location for this site in your browser settings, or tap the map instead."
            : "Couldn't find your location. Try again outside, or tap the map instead."));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    });
  }

  // Reverse geocode with OpenStreetMap Nominatim (free, no key; keep requests light).
  async function placeName(lat, lng, signal) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("lookup failed");
    const a = (await res.json()).address || {};
    const town = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || a.county || "";
    const region = a.state || a.region || a.province || a.country || "";
    const city = [town, region].filter(Boolean).join(", ");
    const street = a.road ? (a.house_number ? `Near ${a.house_number} ${a.road}` : `On ${a.road}`) : (a.park || a.leisure || "");
    return { city, street };
  }

  // ---------- main map ----------
  function pinIcon(kind) {
    return L.divIcon({ className: "", html: `<div class="pin ${kind}"></div>`, iconSize: [26, 26], iconAnchor: [13, 30], popupAnchor: [0, -28] });
  }

  function initMap() {
    map = L.map("map", { zoomControl: true, worldCopyJump: true }).setView([20, 0], 2);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(map);
    cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45, spiderfyOnMaxZoom: true });
    map.addLayer(cluster);
    map.on("moveend", renderList);
  }

  function popupHtml(t) {
    const img = photoUrl(t, true);
    return `<div class="pop">
      ${img ? `<img src="${img}" alt="" loading="lazy">` : ""}
      <b>${esc(t.fruit)}</b>
      <div>${statusPill(t)}</div>
      <div>${esc(t.place)}</div>
      <div class="row">
        <a href="${directionsUrl(t)}" target="_blank" rel="noopener">Directions ↗</a>
        <button type="button" class="link" data-open="${esc(t.id)}">Notes &amp; details</button>
      </div></div>`;
  }

  function filtered() {
    const q = state.q.toLowerCase();
    return state.trees.filter((t) =>
      (!state.city || cityOf(t) === state.city) &&
      (!state.fruit || t.fruit === state.fruit) &&
      (!state.status || t.status === state.status) &&
      (!q || `${t.fruit} ${t.place} ${t.city}`.toLowerCase().includes(q)));
  }

  function renderMarkers() {
    cluster.clearLayers();
    const markers = filtered().map((t) => {
      const m = L.marker([t.lat, t.lng], { icon: pinIcon(t.status === "yes" ? "yes" : "no"), title: `${t.fruit} tree`, alt: `${t.fruit} tree` });
      m.bindPopup(() => popupHtml(t), { maxWidth: 240 });
      return m;
    });
    cluster.addLayers(markers);
  }

  function renderFilters() {
    const count = (key) => state.trees.reduce((acc, t) => { const k = key(t); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const fill = (sel, label, counts, current) => {
      const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
      if (current && !counts[current]) keys.unshift(current);
      sel.innerHTML = `<option value="">${label}</option>` +
        keys.map((k) => `<option value="${esc(k)}">${esc(k)} (${counts[k] || 0})</option>`).join("");
      sel.value = current;
    };
    fill($("citySel"), "All cities", count(cityOf), state.city);
    fill($("fruitSel"), "All fruit", count((t) => t.fruit), state.fruit);
  }

  function renderList() {
    if (!map) return;
    const bounds = map.getBounds();
    const center = map.getCenter();
    const all = filtered();
    const inView = all.filter((t) => bounds.contains([t.lat, t.lng]))
      .map((t) => ({ t, km: distanceKm({ lat: center.lat, lng: center.lng }, t) }))
      .sort((a, b) => a.km - b.km);
    const shown = inView.slice(0, 100);
    $("listCount").textContent = state.trees.length ? `${inView.length} of ${all.length}` : "";
    const list = $("list");
    if (!state.trees.length) {
      list.innerHTML = `<div class="empty"><h3>No trees yet</h3><p>Know a fig over a sidewalk or a lemon tree in a park? Put it on the map.</p><button type="button" class="btn" data-add>+ Add the first tree</button></div>`;
      return;
    }
    if (!all.length) {
      list.innerHTML = `<div class="empty"><h3>No matches</h3><p>No trees match these filters.</p><button type="button" class="btn ghost" data-clear>Clear filters</button></div>`;
      return;
    }
    if (!inView.length) {
      list.innerHTML = `<div class="empty"><h3>No trees in this part of the map</h3><p>Zoom out or move the map to see more.</p><button type="button" class="btn ghost" data-fit>Show all matching trees</button></div>`;
      return;
    }
    list.innerHTML = shown.map(({ t, km }) => {
      const img = photoUrl(t, true);
      return `<button type="button" class="item" data-open="${esc(t.id)}">
        ${img ? `<img class="thumb" src="${img}" alt="" loading="lazy">` : `<span class="thumb">No photo</span>`}
        <span style="min-width:0">
          <h3>${esc(t.fruit)}</h3>
          <div class="where">${esc(t.place)}</div>
          <div class="meta">${statusPill(t)}<span>${t.noteCount || 0} note${t.noteCount === 1 ? "" : "s"}</span><span>${fmtDist(km)} from center</span></div>
        </span></button>`;
    }).join("") + (inView.length > shown.length ? `<p class="muted small">Showing the closest 100. Zoom in to see others.</p>` : "");
  }

  function fitTo(trees) {
    if (!trees.length) return;
    if (trees.length === 1) map.setView([trees[0].lat, trees[0].lng], 16);
    else map.fitBounds(L.latLngBounds(trees.map((t) => [t.lat, t.lng])), { padding: [30, 30], maxZoom: 16 });
  }

  function renderAll() {
    renderFilters();
    renderMarkers();
    renderList();
  }

  async function loadTrees(first) {
    try {
      const { trees } = await api("/api/trees");
      if (!first && JSON.stringify(trees) === JSON.stringify(state.trees)) return;
      state.trees = trees;
      if (state.city && !trees.some((t) => cityOf(t) === state.city)) state.city = "";
      renderAll();
      if (first) {
        const open = location.hash.match(/^#tree-([a-f0-9]{16})$/);
        const target = open && trees.find((t) => t.id === open[1]);
        if (target) { map.setView([target.lat, target.lng], 17); openTree(target.id); }
        else if (state.city) fitTo(filtered());
        else if (trees.length) fitTo(trees);
      }
    } catch (e) {
      $("list").innerHTML = "";
      banner(esc(e.message), () => loadTrees(first));
    }
  }

  // ---------- filters ----------
  $("citySel").addEventListener("change", (e) => {
    state.city = e.target.value;
    store.set("ff-city", state.city);
    renderMarkers();
    fitTo(filtered());
    renderList();
  });
  $("fruitSel").addEventListener("change", (e) => { state.fruit = e.target.value; renderMarkers(); renderList(); });
  document.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", () => {
    state.status = b.dataset.status;
    document.querySelectorAll("[data-status]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderMarkers();
    renderList();
  }));
  let searchTimer;
  $("search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = e.target.value.trim(); renderMarkers(); renderList(); }, 150);
  });

  $("locateBtn").addEventListener("click", async () => {
    const btn = $("locateBtn");
    btn.disabled = true;
    btn.textContent = "Finding you…";
    try {
      const p = await locate();
      if (meMarker) meMarker.remove();
      meMarker = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [16, 16] }), interactive: false, keyboard: false }).addTo(map);
      if (state.city) {
        state.city = "";
        store.set("ff-city", "");
        renderFilters();
        renderMarkers();
      }
      map.setView([p.lat, p.lng], 15);
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "◎ Near me";
    }
  });

  // ---------- sheets ----------
  function openSheet(id) {
    $(id).hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeSheet(id) {
    if ($(id).hidden) return;
    $(id).hidden = true;
    if ($("addSheet").hidden && $("treeSheet").hidden) document.body.style.overflow = "";
    if (id === "treeSheet") {
      state.openId = null;
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    }
  }
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeSheet(b.closest(".overlay").id)));
  document.querySelectorAll(".overlay").forEach((o) => o.addEventListener("mousedown", (e) => { if (e.target === o) closeSheet(o.id); }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeSheet("treeSheet"); closeSheet("addSheet"); } });

  document.addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) { map.closePopup(); openTree(open.dataset.open); return; }
    if (e.target.closest("[data-add]")) { openAdd(); return; }
    if (e.target.closest("[data-fit]")) { fitTo(filtered()); return; }
    if (e.target.closest("[data-clear]")) {
      Object.assign(state, { city: "", fruit: "", status: "", q: "" });
      store.set("ff-city", "");
      $("search").value = "";
      document.querySelectorAll("[data-status]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.status === "")));
      renderAll();
      fitTo(state.trees);
    }
  });

  // ---------- add a tree ----------
  $("fruitList").innerHTML = FRUITS.map((f) => `<option value="${f}">`).join("");

  function setPin(lat, lng, how) {
    pinSet = true;
    pickPin.setLatLng([lat, lng]);
    pickPin.setIcon(pinIcon("new"));
    pickMap.setView([lat, lng], Math.max(pickMap.getZoom(), 17));
    $("pinMsg").innerHTML = `<span class="ok">Pin placed</span> ${esc(how)} · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    lookUpPlace(lat, lng);
  }

  function lookUpPlace(lat, lng) {
    clearTimeout(geoTimer);
    if (geoAbort) geoAbort.abort();
    geoTimer = setTimeout(async () => {
      geoAbort = new AbortController();
      try {
        const { city, street } = await placeName(lat, lng, geoAbort.signal);
        if (!cityEdited && city) $("city").value = city;
        if (!placeEdited && street) $("place").value = street;
      } catch { /* the user can type the city themselves */ }
    }, 600);
  }

  function openAdd() {
    closeSheet("treeSheet");
    $("addForm").reset();
    $("addName").value = store.get("ff-name", "");
    photo = null;
    pinSet = cityEdited = placeEdited = false;
    $("preview").hidden = true;
    $("dropText").innerHTML = "<b>Take or choose a photo</b><br><small>If it has location data, we'll place the pin for you.</small>";
    $("pinMsg").textContent = "No pin yet. Use your location or tap the map where the tree is.";
    $("addErr").hidden = true;
    openSheet("addSheet");
    const start = map.getCenter();
    const zoom = Math.max(map.getZoom(), 3);
    if (!pickMap) {
      pickMap = L.map("pickMap", { zoomControl: true }).setView(start, zoom);
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(pickMap);
      pickPin = L.marker(start, { draggable: true, icon: pinIcon("no"), opacity: 0.5 }).addTo(pickMap);
      pickPin.on("dragend", () => { const p = pickPin.getLatLng(); pickPin.setOpacity(1); setPin(p.lat, p.lng, "by dragging"); });
      pickMap.on("click", (e) => { pickPin.setOpacity(1); setPin(e.latlng.lat, e.latlng.lng, "on the map"); });
    } else {
      pickMap.setView(start, zoom);
      pickPin.setLatLng(start).setIcon(pinIcon("no")).setOpacity(0.5);
    }
    setTimeout(() => pickMap.invalidateSize(), 50);
  }
  $("addBtn").addEventListener("click", openAdd);
  $("city").addEventListener("input", () => { cityEdited = true; });
  $("place").addEventListener("input", () => { placeEdited = true; });

  $("useLoc").addEventListener("click", async () => {
    const btn = $("useLoc");
    btn.disabled = true;
    btn.textContent = "Finding you…";
    try {
      const p = await locate();
      pickPin.setOpacity(1);
      setPin(p.lat, p.lng, p.accuracy > 50 ? `at your location (about ±${Math.round(p.accuracy)} m, drag to fine-tune)` : "at your location");
    } catch (e) {
      $("pinMsg").textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "◎ Use my location";
    }
  });

  // Photo: read GPS from EXIF, then shrink to a full image and a thumbnail.
  function readGps(buf) {
    try {
      const v = new DataView(buf);
      if (v.getUint16(0) !== 0xffd8) return null;
      let off = 2;
      while (off + 4 <= v.byteLength) {
        const marker = v.getUint16(off);
        const size = v.getUint16(off + 2);
        if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
          const t = off + 10;
          const le = v.getUint16(t) === 0x4949;
          const u16 = (o) => v.getUint16(t + o, le);
          const u32 = (o) => v.getUint32(t + o, le);
          const ifd0 = u32(4);
          let gps = 0;
          for (let i = 0, n = u16(ifd0); i < n; i++) if (u16(ifd0 + 2 + i * 12) === 0x8825) gps = u32(ifd0 + 2 + i * 12 + 8);
          if (!gps) return null;
          const g = {};
          for (let i = 0, n = u16(gps); i < n; i++) {
            const e = gps + 2 + i * 12;
            const tag = u16(e);
            if (tag === 1 || tag === 3) g[tag] = String.fromCharCode(v.getUint8(t + e + 8));
            if (tag === 2 || tag === 4) {
              const p = u32(e + 8);
              const r = (k) => u32(p + k * 8) / u32(p + k * 8 + 4);
              g[tag] = r(0) + r(1) / 60 + r(2) / 3600;
            }
          }
          const lat = g[1] === "S" ? -g[2] : g[2];
          const lng = g[3] === "W" ? -g[4] : g[4];
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
          return { lat, lng };
        }
        if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
        off += 2 + size;
      }
    } catch { /* no usable GPS */ }
    return null;
  }

  async function decode(file) {
    if ("createImageBitmap" in window) {
      try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fall back */ }
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

  function resize(img, max, quality) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob(res, "image/jpeg", quality));
  }

  async function takePhoto(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { $("dropText").innerHTML = "<b>That isn't an image.</b><br><small>Choose a photo of the tree.</small>"; return; }
    $("dropText").textContent = "Preparing photo…";
    const gps = readGps(await file.slice(0, 256 * 1024).arrayBuffer());
    try {
      const img = await decode(file);
      const [full, thumb] = await Promise.all([resize(img, 1600, 0.82), resize(img, 400, 0.75)]);
      if (!full || !thumb) throw new Error("encode failed");
      photo = { full, thumb };
    } catch {
      photo = null;
      $("preview").hidden = true;
      $("dropText").innerHTML = "<b>That photo couldn't be read.</b><br><small>Try a JPG or PNG, or take a new photo.</small>";
      return;
    }
    if ($("preview").src) URL.revokeObjectURL($("preview").src);
    $("preview").src = URL.createObjectURL(photo.full);
    $("preview").hidden = false;
    $("dropText").innerHTML = "<small>Tap to change photo</small>";
    if (gps && !pinSet) {
      pickPin.setOpacity(1);
      setPin(gps.lat, gps.lng, "from your photo's location");
    }
  }
  $("drop").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", (e) => { takePhoto(e.target.files[0]); e.target.value = ""; });
  $("drop").addEventListener("dragover", (e) => e.preventDefault());
  $("drop").addEventListener("drop", (e) => { e.preventDefault(); takePhoto(e.dataTransfer.files[0]); });

  $("addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fail = (msg, focusId) => {
      $("addErr").textContent = msg;
      $("addErr").hidden = false;
      if (focusId) $(focusId).focus();
    };
    const fruit = $("fruit").value.trim();
    const status = (document.querySelector("input[name=status]:checked") || {}).value;
    const place = $("place").value.trim();
    if (!pinSet) return fail("Drop a pin on the map where the tree is.", "useLoc");
    if (!place) return fail("Describe where the tree is so people can find it.", "place");
    if (!fruit) return fail("Say what kind of fruit it is.", "fruit");
    if (!status) return fail("Say whether it's fruiting right now.");

    const p = pickPin.getLatLng();
    const name = $("addName").value.trim();
    store.set("ff-name", name);
    const form = new FormData();
    form.set("fruit", fruit);
    form.set("place", place);
    form.set("city", $("city").value.trim());
    form.set("lat", p.lat.toFixed(6));
    form.set("lng", L.Util.wrapNum(p.lng, [-180, 180], true).toFixed(6));
    form.set("status", status);
    form.set("note", $("firstNote").value.trim());
    form.set("name", name);
    form.set("website", $("website").value);
    if (photo) {
      form.set("photo", photo.full, "photo.jpg");
      form.set("thumb", photo.thumb, "thumb.jpg");
    }

    const btn = $("saveTree");
    btn.disabled = true;
    btn.textContent = "Posting…";
    $("addErr").hidden = true;
    try {
      const { tree, editToken } = await api("/api/trees", { method: "POST", body: form });
      if (tree) {
        const all = tokens();
        all[tree.id] = editToken;
        store.set("ff-tokens", all);
        state.trees = [tree, ...state.trees];
        if (state.city && cityOf(tree) !== state.city) { state.city = ""; store.set("ff-city", ""); }
        renderAll();
        closeSheet("addSheet");
        map.setView([tree.lat, tree.lng], 17);
        toast("Tree posted. Thanks!");
      }
    } catch (err) {
      if (err.status === 409 && err.body && err.body.existingId) {
        fail(err.message + " Open it and add a note instead.");
        const link = document.createElement("button");
        link.type = "button";
        link.className = "btn small";
        link.textContent = "Open that tree";
        link.dataset.open = err.body.existingId;
        $("addErr").append(" ", link);
        if (!state.trees.some((t) => t.id === err.body.existingId)) loadTrees(false);
      } else {
        fail(err.message);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Post tree";
    }
  });

  // ---------- tree details ----------
  async function openTree(id) {
    const t = state.trees.find((x) => x.id === id);
    if (!t) { toast("That tree has been removed."); return; }
    closeSheet("addSheet");
    state.openId = id;
    history.replaceState(null, "", "#tree-" + id);
    $("treeTitle").textContent = `${t.fruit} tree`;
    const img = photoUrl(t, false);
    $("treePhoto").innerHTML = img ? `<img class="tree-photo" src="${img}" alt="${esc(t.fruit)} tree">` : "";
    renderTreeInfo(t);
    $("dirLink").href = directionsUrl(t);
    $("delTree").hidden = !tokens()[id];
    $("noteForm").reset();
    $("noteName").value = store.get("ff-name", "");
    $("noteErr").hidden = true;
    $("notes").innerHTML = `<p class="muted small">Loading notes…</p>`;
    openSheet("treeSheet");
    try {
      const { notes } = await api(`/api/trees/${id}/notes`);
      if (state.openId === id) renderNotes(notes);
    } catch (e) {
      if (state.openId === id) $("notes").innerHTML = `<p class="err">${esc(e.message)}</p>`;
    }
  }

  function renderTreeInfo(t) {
    $("treeInfo").innerHTML = `
      <div>${statusPill(t)}</div>
      <div class="where">${esc(t.place)}</div>
      <div class="muted small">${esc(cityOf(t))} · ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)} · added ${esc(ago(t.createdAt))}</div>`;
  }

  function renderNotes(notes) {
    $("notes").innerHTML = notes.length ? notes.map((n) => `
      <div class="note ${n.status === "yes" ? "yes" : ""}">
        <div class="by">${esc(n.name || "Someone")} · ${esc(ago(n.createdAt))}${n.status ? ` · ${n.status === "yes" ? "saw fruit" : "no fruit"}` : ""}</div>
        ${n.text ? `<p>${esc(n.text)}</p>` : ""}
      </div>`).join("") : `<p class="muted small">No notes yet. Be the first to say when it fruits.</p>`;
  }

  $("shareBtn").addEventListener("click", async () => {
    const url = location.origin + location.pathname + "#tree-" + state.openId;
    try {
      if (navigator.share) await navigator.share({ title: $("treeTitle").textContent, url });
      else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    } catch (e) {
      if (e && e.name !== "AbortError") toast(url);
    }
  });

  $("noteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = state.openId;
    const text = $("noteText").value.trim();
    const status = (document.querySelector("input[name=nstatus]:checked") || {}).value || "";
    const name = $("noteName").value.trim();
    if (!text && !status) {
      $("noteErr").textContent = "Write a note or say whether it's fruiting.";
      $("noteErr").hidden = false;
      return;
    }
    store.set("ff-name", name);
    const btn = $("saveNote");
    btn.disabled = true;
    $("noteErr").hidden = true;
    try {
      const { tree } = await api(`/api/trees/${id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, status, name }),
      });
      state.trees = state.trees.map((t) => (t.id === id ? tree : t));
      renderAll();
      if (state.openId === id) {
        renderTreeInfo(tree);
        $("noteText").value = "";
        document.querySelector("input[name=nstatus][value='']").checked = true;
        const { notes } = await api(`/api/trees/${id}/notes`);
        if (state.openId === id) renderNotes(notes);
      }
      toast("Note posted");
    } catch (err) {
      $("noteErr").textContent = err.message;
      $("noteErr").hidden = false;
      if (err.status === 404) loadTrees(false);
    } finally {
      btn.disabled = false;
    }
  });

  let armed = null;
  $("delTree").addEventListener("click", async () => {
    const btn = $("delTree");
    const id = state.openId;
    if (armed !== id) {
      armed = id;
      btn.textContent = "Tap again to remove";
      setTimeout(() => { if (armed === id) { armed = null; btn.textContent = "Remove tree"; } }, 4000);
      return;
    }
    armed = null;
    btn.textContent = "Remove tree";
    btn.disabled = true;
    try {
      await api(`/api/trees/${id}`, { method: "DELETE", headers: { "x-edit-token": tokens()[id] || "" } });
      const all = tokens();
      delete all[id];
      store.set("ff-tokens", all);
      state.trees = state.trees.filter((t) => t.id !== id);
      renderAll();
      closeSheet("treeSheet");
      toast("Tree removed");
    } catch (err) {
      $("noteErr").textContent = err.message;
      $("noteErr").hidden = false;
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener("hashchange", () => {
    const m = location.hash.match(/^#tree-([a-f0-9]{16})$/);
    if (m && m[1] !== state.openId) openTree(m[1]);
  });

  // ---------- boot ----------
  if (!window.L) {
    banner("The map couldn't load. Check your connection and reload the page.");
    return;
  }
  state.city = store.get("ff-city", "");
  initMap();
  loadTrees(true);
  // Pick up trees other people add while the page is open.
  setInterval(() => { if (document.visibilityState === "visible" && $("addSheet").hidden) loadTrees(false); }, 60000);
})();
