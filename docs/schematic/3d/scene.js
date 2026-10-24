// The 3D bench. Coordinates are the isometric figure's world units (1 unit ≈ 2.5 mm):
// x along the bench, y toward the viewer, z up. W() maps them into Three.js (y up).
// Everything that can be hovered carries userData.label; everything that moves is
// returned in `live` so the UI can drive it from the model.

function buildScene(THREE, OrbitControls, MODEL, canvas, opts = {}) {
  const W = (x, y, z) => new THREE.Vector3(x, z, y);
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------- renderer, camera, lights
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1.6, 1, 2000);
  camera.position.copy(W(10, 340, 190));
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(W(20, 0, 8));
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 30;
  controls.maxDistance = 700;
  controls.update();

  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3630, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.copy(W(-60, 90, 190));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220; sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 20; sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.6);
  fill.position.copy(W(180, -120, 90));
  scene.add(fill);

  // ---------------------------------------------------------------- materials
  const std = (color, { metalness = 0, roughness = 0.6, emissive = 0x000000, ...rest } = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, ...rest });
  const M = {
    alu: std(0xb9bec6, { metalness: 0.75, roughness: 0.38 }),
    aluDark: std(0x8e949c, { metalness: 0.7, roughness: 0.45 }),
    rubber: std(0x202226, { roughness: 0.95 }),
    abs: std(0x2b2e34, { roughness: 0.55 }),
    absLight: std(0x4a4f58, { roughness: 0.5 }),
    knob: std(0x16171a, { roughness: 0.4 }),
    dial: std(0xf2efe6, { roughness: 0.6 }),
    needle: std(0xc0392b, { roughness: 0.4 }),
    brass: std(0xc9a44a, { metalness: 0.9, roughness: 0.32 }),
    copper: std(0xb87333, { metalness: 0.92, roughness: 0.3 }),
    enamel: std(0xc8742c, { metalness: 0.75, roughness: 0.42 }),
    canBody: std(0x15171c, { roughness: 0.5 }),
    canTop: std(0xd8cfbf, { metalness: 0.5, roughness: 0.4 }),
    canSleeve: std(0x2a4a8a, { roughness: 0.55 }),
    ceramic: std(0xe9e3d5, { roughness: 0.85 }),
    pcb: std(0x1f6b3a, { roughness: 0.6 }),
    pcbDark: std(0x174d2b, { roughness: 0.6 }),
    chip: std(0x111214, { roughness: 0.5 }),
    pad: std(0xd0c09a, { metalness: 0.8, roughness: 0.4 }),
    button: std(0xc0392b, { roughness: 0.45 }),
    heatsink: std(0x6f7781, { metalness: 0.65, roughness: 0.5 }),
    scr: std(0x0f1012, { roughness: 0.45 }),
    steel: std(0x9aa0a8, { metalness: 0.95, roughness: 0.28 }),
    foam: std(0x7a8577, { roughness: 1 }),
    phenolic: std(0x241a14, { roughness: 0.7 }),
    acrylic: new THREE.MeshPhysicalMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.3, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide, depthWrite: false }),
    glassRim: std(0xa9c4d2, { roughness: 0.2, transparent: true, opacity: 0.6 }),
    cableRed: std(0xc0392b, { roughness: 0.8 }),
    cableBlack: std(0x1b1c1f, { roughness: 0.8 }),
    cableGrey: std(0x8a8f98, { roughness: 0.8 }),
    cableYellow: std(0xd9b24a, { roughness: 0.8 }),
    cableBlue: std(0x2d6cdf, { roughness: 0.8 }),
    led: std(0x5a1a1a, { roughness: 0.3, emissive: 0x000000 }),
    ledGreen: std(0x1a4a1a, { roughness: 0.3 }),
    irLens: std(0x3a2a44, { roughness: 0.2, transparent: true, opacity: 0.9 }),
    diode: std(0x1a1a1c, { roughness: 0.4 }),
    terminal: std(0xb8b29a, { metalness: 0.85, roughness: 0.4 }),
    tray: std(0x3b3f46, { roughness: 0.7 }),
    label: std(0xe6e1d6, { roughness: 0.8 }),
  };

  // ---------------------------------------------------------------- groups and pickables
  const groups = {};
  const GROUP_INFO = {
    bench: { title: "Bench", explode: [0, 0, 0] },
    charger: { title: "1 · Charging circuit", explode: [-34, -10, 26] },
    bank: { title: "2 · Capacitor bank", explode: [-12, -14, 36] },
    switch: { title: "3 · SCR switch and trigger", explode: [8, -8, 30] },
    coil: { title: "4 · Coil, barrel and flyback", explode: [24, 14, 34] },
    sensing: { title: "5 · Sensing and timing", explode: [40, -8, 26] },
    cables: { title: "Wiring", explode: [0, 0, 0] },
  };
  for (const id of Object.keys(GROUP_INFO)) {
    const g = new THREE.Group();
    g.name = id;
    g.userData.home = new THREE.Vector3();
    scene.add(g);
    groups[id] = g;
  }
  const pickables = [];
  const live = { emissive: {}, cables: [] };

  function add(group, mesh, label, { shadow = true, pick = true } = {}) {
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    if (label) {
      mesh.userData.label = typeof label === "string" ? { name: label } : label;
      mesh.userData.group = group;
      if (pick) pickables.push(mesh);
    }
    groups[group].add(mesh);
    return mesh;
  }
  const box = (group, [x0, y0, z0], [x1, y1, z1], mat, label, opts) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat);
    m.position.copy(W((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    return add(group, m, label, opts);
  };
  const cylZ = (group, x, y, z0, z1, r, mat, label, { segs = 32, r0 } = {}) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r0 ?? r, z1 - z0, segs), mat);
    m.position.copy(W(x, y, (z0 + z1) / 2));
    return add(group, m, label);
  };
  const cylX = (group, x0, x1, y, z, r, mat, label, { segs = 32, r1 } = {}) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1 ?? r, r, x1 - x0, segs), mat);
    m.rotation.z = -Math.PI / 2;
    m.position.copy(W((x0 + x1) / 2, y, z));
    return add(group, m, label);
  };
  const cylY = (group, x, y0, y1, z, r, mat, label, { segs = 32 } = {}) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, segs), mat);
    m.rotation.x = Math.PI / 2;
    m.position.copy(W(x, (y0 + y1) / 2, z));
    return add(group, m, label);
  };
  // an annulus with thickness along x (a ring, a tube, a coil cheek)
  const ringX = (group, x0, x1, y, z, rIn, rOut, mat, label, { segs = 48, shadow = true } = {}) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: segs });
    geo.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(W(x0, y, z));
    return add(group, m, label, { shadow });
  };
  const sphere = (group, [x, y, z], r, mat, label) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
    m.position.copy(W(x, y, z));
    return add(group, m, label);
  };
  // a cable: straight legs with rounded corners, as a tube
  function routeCurve(points, bend) {
    const pts = points.map((p) => W(...p));
    const path = new THREE.CurvePath();
    let prev = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const la = b.distanceTo(a), lc = b.distanceTo(c);
      const r = Math.min(bend, la * 0.48, lc * 0.48);
      const p1 = b.clone().add(a.clone().sub(b).setLength(r));
      const p2 = b.clone().add(c.clone().sub(b).setLength(r));
      if (p1.distanceTo(prev) > 1e-4) path.add(new THREE.LineCurve3(prev, p1));
      path.add(new THREE.QuadraticBezierCurve3(p1, b, p2));
      prev = p2;
    }
    const last = pts[pts.length - 1];
    if (last.distanceTo(prev) > 1e-4) path.add(new THREE.LineCurve3(prev, last));
    return path;
  }
  function cable(name, points, r, mat, label, { bend = 3, hot = false, ends = [true, true] } = {}) {
    const curve = routeCurve(points, Math.max(bend, r * 2.8));
    const segs = Math.max(24, Math.round(curve.getLength() / 1.2));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 14, false), mat.clone());
    m.name = name;
    add("cables", m, label);
    live.cables.push(m);
    if (hot) (live.emissive[hot] ??= []).push(m);
    // ferrules or solder dots at the ends
    ends.forEach((on, i) => {
      if (!on) return;
      const p = i ? points[points.length - 1] : points[0];
      sphere("cables", p, r * 1.25, M.terminal, null);
    });
    return m;
  }

  // ---------------------------------------------------------------- layout (same numbers as the isometric figure)
  const PLATE = { x0: -150, x1: 186, y0: -62, y1: 62, h: 10 };
  const BARREL = { x0: 50, x1: 150, y: 32, z: 26, r: 6, bore: 5.2 };
  const COIL = { s0: 83, s1: 107, rOut: 11 };
  const GATE_X = 140;
  const CATCH = { x0: 158, x1: 182, y0: 18, y1: 46, z1: 38 };
  const SLUG = { r: 4.8, len: 12, breech: BARREL.x0 + 6 };
  const SCALE = (BARREL.x1 - BARREL.x0) / MODEL.DEFAULTS.barrelLen; // world units per metre
  const L = (name, value, role) => ({ name, value, role });

  // ---------------------------------------------------------------- bench
  box("bench", [PLATE.x0, PLATE.y0, -PLATE.h], [PLATE.x1, PLATE.y1, 0], M.alu, L("Bench plate", "6 mm aluminium", "Everything bolts to it; it is also the safety ground."));
  for (const [x, y] of [[PLATE.x0 + 22, PLATE.y0 + 22], [PLATE.x1 - 22, PLATE.y0 + 22], [PLATE.x0 + 22, PLATE.y1 - 22], [PLATE.x1 - 22, PLATE.y1 - 22], [18, PLATE.y0 + 22], [18, PLATE.y1 - 22]]) {
    cylZ("bench", x, y, -PLATE.h - 5, -PLATE.h, 6, M.rubber, null);
  }
  box("bench", [PLATE.x0 + 14, PLATE.y1 - 12, 0], [PLATE.x1 - 14, PLATE.y1 - 6, 0.6], M.absLight, L("Ruler strip", "mm scale", "Engraved scale along the front edge."));
  // HV area mat: a thin rubber inlay under the high-voltage blocks
  box("bench", [-92, -56, 0], [152, 40, 0.5], std(0x343a44, { roughness: 0.92 }), L("High-voltage area", "> 50 V", "Everything inside this mat is a shock hazard while the bank holds charge."));
  // label plate
  box("bench", [-40, 30, 0], [-8, 43, 0.8], M.label, L("Label plate", "", "Nameplate for the bench."));
  // discharge stick in clips, with its ground lead
  const STICK = { x0: -78, x1: -22, y: 55, z: 3.2 };
  for (const x of [STICK.x0 + 8, STICK.x0 + 26]) box("bench", [x - 1.2, STICK.y - 2.6, 0], [x + 1.2, STICK.y + 2.6, 2.2], M.absLight, null);
  cylX("bench", STICK.x0, STICK.x0 + 30, STICK.y, STICK.z, 1.3, M.phenolic, L("Discharge stick", "1 kΩ 25 W in a fibreglass rod", "Bleeds a bank that the bleeder has not finished yet. Touch nothing before the meter reads under 50 V."));
  cylX("bench", STICK.x0 + 30, STICK.x0 + 34, STICK.y, STICK.z, 1.0, M.steel, null);
  cylX("bench", STICK.x0 + 34, STICK.x0 + 46.6, STICK.y, STICK.z, 2.0, M.ceramic, L("Discharge resistor", "1 kΩ 25 W", "Limits the discharge current so the probe does not weld."));
  cylX("bench", STICK.x0 + 46.6, STICK.x0 + 56, STICK.y, STICK.z, 0.9, M.steel, null, { r1: 0.2 });
  cylZ("bench", -88, 52, 0, 4, 1.6, M.brass, L("Ground post", "", "Return for the discharge stick."));
  cable("stick.gnd", [[STICK.x0, STICK.y, STICK.z], [STICK.x0 - 4, STICK.y, STICK.z], [-84, 52, 4.6], [-88, 52, 7], [-88, 52, 4]], 0.5, M.cableGrey, L("Discharge lead", "", "Grounds the stick's return."), { bend: 2.6 });
  // spare slugs tray
  box("bench", [118, 44, 0], [141, 56, 1.4], M.tray, L("Spare slugs", "8 g steel each", "Soft iron or mild steel, never a magnet: the field must pull it, then let it go."));
  for (const x of [124.5, 134.5]) cylY("bench", x, 46.2, 53.8, 1.4 + SLUG.r, SLUG.r, M.steel, null);
  // catch box past the muzzle
  box("coil", [CATCH.x0, CATCH.y0, 0], [CATCH.x1, CATCH.y1, CATCH.z1], M.foam, L("Catch box", "dense foam", "Stops the slug. A real range needs a steel backstop behind it."));
  box("coil", [CATCH.x0 - 1.5, CATCH.y0 - 1.5, 0], [CATCH.x1 + 1.5, CATCH.y1 + 1.5, 3], M.abs, null);

  // ---------------------------------------------------------------- block 1: charger
  const CH = { x0: -142, x1: -104, y0: -44, y1: -12, z1: 24 };
  box("charger", [CH.x0, CH.y0, 0], [CH.x1, CH.y1, CH.z1], M.abs, L("Boost charger", "1 A limit, 50–450 V out", "Steps the low-voltage input up to the bank rating; the current limit makes charging controlled."));
  for (let i = 0; i < 7; i++) box("charger", [CH.x0 + 3 + i * 4.4, CH.y0 + 2, CH.z1], [CH.x0 + 4.4 + i * 4.4, CH.y0 + 7.5, CH.z1 + 3], M.heatsink, null);
  for (const x of [-130, -124, -118]) box("charger", [x - 1.1, CH.y1 - 0.4, 10.5], [x + 1.1, CH.y1 + 0.1, 19.5], M.chip, null);
  // knob on the front face
  const KNOB = { c: [-112, CH.y1, 10], r: 4.2, len: 3.2 };
  cylY("charger", KNOB.c[0], KNOB.c[1], KNOB.c[1] + 0.8, KNOB.c[2], KNOB.r + 1.2, M.absLight, null);
  const knob = cylY("charger", KNOB.c[0], KNOB.c[1] + 0.8, KNOB.c[1] + 0.8 + KNOB.len, KNOB.c[2], KNOB.r, M.knob, L("Voltage set knob", "50–450 V", "Sets the charger's output. Drag it, or use ↑ ↓."), { segs: 40 });
  const knobIndex = box("charger", [KNOB.c[0] - 0.35, KNOB.c[1] + 0.8 + KNOB.len - 0.2, KNOB.c[2] + 0.6], [KNOB.c[0] + 0.35, KNOB.c[1] + 0.8 + KNOB.len + 0.15, KNOB.c[2] + KNOB.r - 0.6], M.dial, null);
  // the knob and its index turn together about the knob axis
  const knobPivot = new THREE.Group();
  knobPivot.position.copy(W(KNOB.c[0], KNOB.c[1], KNOB.c[2]));
  groups.charger.add(knobPivot);
  for (const m of [knob, knobIndex]) { groups.charger.remove(m); m.position.sub(knobPivot.position); knobPivot.add(m); }
  live.knobPivot = knobPivot;
  // jack and LED
  cylY("charger", -134, CH.y1, CH.y1 + 2.4, 8, 2.4, M.chip, L("DC input jack", "12–24 V in", "The battery or bench supply plugs in here."));
  const chargeLed = sphere("charger", [CH.x1 + 0.4, -20, 20], 0.9, M.led.clone(), L("Charge lamp", "", "On while the charger is pushing current into the bank."));
  live.emissive.charge = [chargeLed];
  // voltmeter on top
  const METER = { c: [-123, -28], r: 7.5, z: CH.z1, h: 5 };
  cylZ("charger", METER.c[0], METER.c[1], METER.z, METER.z + METER.h, METER.r, M.absLight, L("Bank voltmeter", "0–500 V", "Reads the bank, not the set point. The bleed is done when it is under 50 V."), { segs: 48 });
  cylZ("charger", METER.c[0], METER.c[1], METER.z + METER.h, METER.z + METER.h + 0.2, METER.r - 1.2, M.dial, null, { segs: 48 });
  for (let i = 0; i <= 10; i++) {
    const a = -135 * DEG + (270 * DEG * i) / 10;
    const rr = METER.r - 2.4;
    const t = box("charger", [-0.25, -0.9, 0], [0.25, 0.9, 0.25], M.chip, null);
    t.position.copy(W(METER.c[0] + Math.sin(a) * rr, METER.c[1] - Math.cos(a) * rr, METER.z + METER.h + 0.2));
    t.rotation.y = -a;
  }
  const needlePivot = new THREE.Group();
  needlePivot.position.copy(W(METER.c[0], METER.c[1], METER.z + METER.h + 0.3));
  groups.charger.add(needlePivot);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, METER.r - 2), M.needle);
  needle.position.z = -(METER.r - 2) / 2 + 1.2;
  needlePivot.add(needle);
  needlePivot.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 16), M.chip));
  live.needlePivot = needlePivot;
  // terminals
  const CH_OUT = { pos: [-107, -40, CH.z1], neg: [-107, -27, CH.z1] };
  cylZ("charger", ...CH_OUT.pos.slice(0, 2), CH.z1, CH.z1 + 3, 1.3, M.brass, L("Charger + output", "", "Through the limit resistor to the + bus."));
  cylZ("charger", ...CH_OUT.neg.slice(0, 2), CH.z1, CH.z1 + 3, 1.3, M.brass, L("Charger − output", "", "Straight to the − bus."));
  const CH_EN = [-139, -16, CH.z1], CH_EN2 = [-135, -16, CH.z1];
  for (const c of [CH_EN, CH_EN2]) cylZ("charger", c[0], c[1], CH.z1, CH.z1 + 2.4, 1.1, M.brass, L("Enable terminals", "", "The key switch closes these; open means the charger is off."));
  cylZ("bench", -146, -26, 0, 3.6, 2.2, M.chip, L("Input socket", "12–24 V", "Bench supply or battery lands here."));
  // limit resistor behind the bank
  const RLIM = { x0: -98, x1: -86, y: -52, z: 3.4, r: 2.4 };
  for (const x of [RLIM.x0 + 1.5, RLIM.x1 - 1.5]) box("charger", [x - 0.8, RLIM.y - 2.8, 0], [x + 0.8, RLIM.y + 2.8, 1.4], M.absLight, null);
  cylX("charger", RLIM.x0, RLIM.x1, RLIM.y, RLIM.z, RLIM.r, M.ceramic, L("Charge limit resistor", "47 Ω 25 W", "Backs up the module's own current limit so an inrush cannot cook the output stage."));

  // ---------------------------------------------------------------- block 2: capacitor bank
  const BANK = { x0: -84, x1: -14, y: -30, canR: 7, canH: 24, xs: [-72, -56, -40, -24] };
  box("bank", [BANK.x0, BANK.y - 16, 0], [BANK.x1, BANK.y + 16, 2], M.absLight, L("Bank tray", "", "Holds the cans and the clamp rails."));
  const CAN_TOP = 2 + BANK.canH;
  const TERM_DY = 3.5;
  live.cans = [];
  for (const x of BANK.xs) {
    const can = cylZ("bank", x, BANK.y, 2, CAN_TOP, BANK.canR, M.canSleeve, L("Electrolytic capacitor", "820 µF 450 V", "Four in parallel add up; in series they would need balancing resistors."), { segs: 48 });
    live.cans.push(can);
    cylZ("bank", x, BANK.y, CAN_TOP - 0.01, CAN_TOP + 0.6, BANK.canR - 0.2, M.canTop, null, { segs: 48 });
    cylZ("bank", x, BANK.y, 2, 4.2, BANK.canR + 0.05, M.canBody, null, { segs: 48 });
    for (const dy of [-TERM_DY, TERM_DY]) cylZ("bank", x, BANK.y + dy, CAN_TOP + 0.6, CAN_TOP + 1.6, 1.1, M.brass, null, { segs: 16 });
  }
  for (const dy of [-BANK.canR - 2.6, BANK.canR + 2.6]) {
    box("bank", [BANK.x0 + 2, BANK.y + dy - 1.4, 10], [BANK.x1 - 2, BANK.y + dy + 1.4, 13], M.alu, L("Clamp rail", "", "Keeps the cans from walking under the pulse's magnetic kick."));
    for (const x of [BANK.x0 + 4.5, BANK.x1 - 4.5]) cylZ("bank", x, BANK.y + dy, 2, 10, 1.4, M.steel, null, { segs: 16 });
  }
  const BUS = { z: CAN_TOP + 1.6, h: 1.2, x0: BANK.xs[0] - 5, x1: BANK.xs[3] + 7 };
  const busDy = (id) => (id === "pos" ? -TERM_DY : TERM_DY);
  const busTop = BUS.z + BUS.h;
  const busAt = (id, x) => [x, BANK.y + busDy(id), busTop];
  box("bank", [BUS.x0, BANK.y + busDy("pos") - 1.1, BUS.z], [BUS.x1, BANK.y + busDy("pos") + 1.1, busTop], M.copper, L("+ bus bar", "copper", "Collects the four + terminals. Low inductance matters here: the pulse is kiloamps."));
  box("bank", [BUS.x0, BANK.y + busDy("neg") - 1.1, BUS.z], [BUS.x1, BANK.y + busDy("neg") + 1.1, busTop], M.copper, L("− bus bar", "copper", "Collects the four − terminals."));
  const BLEED = { x0: -60, x1: -36, y: -8, z: 3.8, r: 2.8 };
  for (const x of [BLEED.x0 + 2, BLEED.x1 - 2]) box("bank", [x - 0.9, BLEED.y - 3.2, 0], [x + 0.9, BLEED.y + 3.2, 1.5], M.absLight, null);
  live.bleeder = cylX("bank", BLEED.x0, BLEED.x1, BLEED.y, BLEED.z, BLEED.r, M.ceramic.clone(), L("Bleeder resistor", "10 kΩ 10 W", "Across the bank permanently: drains it whenever the system is off."));

  // ---------------------------------------------------------------- block 3: SCR and gate board
  const HS = { x0: 0, x1: 40, y0: -46, y1: -14, z1: 5 };
  box("switch", [HS.x0, HS.y0, 0], [HS.x1, HS.y1, HS.z1], M.heatsink, L("Heatsink", "anodised aluminium", "The SCR's cathode is its stud, so the heatsink sits at cathode potential."));
  for (let i = 0; i < 8; i++) box("switch", [HS.x0 + 1.5 + i * 5.1, HS.y0 + 1.5, HS.z1], [HS.x0 + 2.9 + i * 5.1, HS.y0 + 15, HS.z1 + 13], M.heatsink, null);
  const SCR = { c: [20, -22], z: HS.z1 };
  const scrHex = cylZ("switch", SCR.c[0], SCR.c[1], SCR.z, SCR.z + 3, 5.2, M.steel, L("SCR (thyristor)", "1200 V, 2 kA surge", "Cheap and tough, but once triggered it stays on until the current reaches zero."), { segs: 6 });
  const scrBody = cylZ("switch", SCR.c[0], SCR.c[1], SCR.z + 3, SCR.z + 8.6, 4.4, M.scr.clone(), L("SCR (thyristor)", "1200 V, 2 kA surge", "Cheap and tough, but once triggered it stays on until the current reaches zero."), { segs: 40 });
  cylZ("switch", SCR.c[0], SCR.c[1], SCR.z + 8.6, SCR.z + 9.4, 2.2, M.scr, null, { segs: 32, r0: 3.4 });
  live.emissive.scr = [scrBody];
  const SCR_ANODE = [SCR.c[0], SCR.c[1], SCR.z + 9.2];
  cylZ("switch", SCR.c[0], SCR.c[1], SCR.z + 9.2, SCR.z + 14, 1.3, M.brass, L("SCR anode post", "", "From the + bus."), { segs: 16 });
  const SCR_GATE = [SCR.c[0] + 5.6, SCR.c[1] + 3.4, SCR.z + 3];
  cylZ("switch", SCR_GATE[0], SCR_GATE[1], SCR.z, SCR.z + 3, 0.7, M.brass, L("Gate tab", "", "A few milliamps here fire the SCR."), { segs: 12 });
  const SCR_K = [6, -17, HS.z1];
  cylZ("switch", SCR_K[0], SCR_K[1], HS.z1, HS.z1 + 2.2, 1.6, M.brass, L("Cathode lug", "", "Heatsink potential, out to the coil."), { segs: 16 });
  box("switch", [28, -20.5, HS.z1], [36, -16, HS.z1 + 6], M.canSleeve, L("Snubber", "RC across the SCR", "Slows the voltage rise so the SCR cannot self-trigger."));
  const GB = { x0: 2, x1: 40, y0: -4, y1: 16, z: 4, t: 1 };
  const gateTop = GB.z + GB.t;
  for (const [x, y] of [[GB.x0 + 2.5, GB.y0 + 2.5], [GB.x1 - 2.5, GB.y0 + 2.5], [GB.x0 + 2.5, GB.y1 - 2.5], [GB.x1 - 2.5, GB.y1 - 2.5]]) cylZ("switch", x, y, 0, GB.z, 1, M.brass, null, { segs: 12 });
  box("switch", [GB.x0, GB.y0, GB.z], [GB.x1, GB.y1, gateTop], M.pcb, L("Gate trigger board", "isolated", "Button or MCU on the low-voltage side, optocoupler across the slot, gate drive on the high-voltage side."));
  box("switch", [GB.x0 + 2, 7.2, gateTop - 0.5], [GB.x1 - 4, 8.8, gateTop + 0.05], M.pcbDark, L("Isolation slot", "", "Nothing conductive crosses it except the optocoupler's light."));
  const chip = (group, x, y, len, wid, tall, label) => box(group, [x, y, gateTop], [x + len, y + wid, gateTop + tall], M.chip, label);
  chip("switch", 8, 9, 7.6, 3, 1.3, L("Optocoupler", "", "Carries the fire command across the isolation slot as light."));
  chip("switch", 20, 10.5, 5, 2.4, 1.1, L("Gate driver", "", "Turns the opto's output into a clean gate pulse."));
  cylX("switch", 26, 31, 2, gateTop + 1.1, 1.1, M.ceramic, L("Gate resistor", "", "Sets the gate current."), { segs: 16 });
  cylZ("switch", 33, 12, gateTop, gateTop + 3.2, 1.4, M.canSleeve, L("Gate supply cap", "", "Holds the drive supply up through the pulse."), { segs: 16 });
  const gateLed = sphere("switch", [36, 3, gateTop + 0.5], 0.8, M.led.clone(), L("Trigger lamp", "", "Blinks on each fire command."));
  live.emissive.gate = [gateLed];
  const BTN = { c: [10, 1.5], r: 2.6 };
  cylZ("switch", BTN.c[0], BTN.c[1], gateTop, gateTop + 1.2, BTN.r + 1, M.absLight, null, { segs: 32 });
  live.button = cylZ("switch", BTN.c[0], BTN.c[1], gateTop + 1.2, gateTop + 3.8, BTN.r, M.button, L("Fire button", "", "Click it, or press space."), { segs: 32 });
  live.button.userData.rest = live.button.position.clone();
  const GATE_OUT = [GB.x0 + 3, GB.y0 + 1.4, gateTop];
  box("switch", [GATE_OUT[0] - 1.4, GATE_OUT[1] - 1.1, gateTop], [GATE_OUT[0] + 1.4, GATE_OUT[1] + 1.1, gateTop + 2.2], M.chip, null);
  const GATE_IN = [GB.x1 - 2.2, 5, gateTop];
  box("switch", [GATE_IN[0] - 1.2, GATE_IN[1] - 2.4, gateTop], [GATE_IN[0] + 1.2, GATE_IN[1] + 2.4, gateTop + 2.2], M.chip, L("Fire input header", "", "From the microcontroller, for later stages."));

  // ---------------------------------------------------------------- block 4: barrel, coil, flyback, slug
  for (const [x0, x1] of [[56, 64], [124, 132]]) box("coil", [x0, BARREL.y - 8, 0], [x1, BARREL.y + 8, BARREL.z - BARREL.r], M.absLight, L("Barrel saddle", "", "V-block holding the tube."));
  live.barrel = ringX("coil", BARREL.x0, BARREL.x1, BARREL.y, BARREL.z, BARREL.bore, BARREL.r, M.acrylic, L("Acrylic barrel", "13 mm bore, 250 mm", "Non-magnetic and non-conductive, so it carries no eddy currents. Clear, so you can watch the slug."), { segs: 64, shadow: false });
  live.barrel.renderOrder = 5;
  ringX("coil", COIL.s0 - 2.2, COIL.s0, BARREL.y, BARREL.z, BARREL.r + 0.05, COIL.rOut + 1.4, M.phenolic, L("Coil cheek", "", "Keeps the winding square."));
  ringX("coil", COIL.s1, COIL.s1 + 2.2, BARREL.y, BARREL.z, BARREL.r + 0.05, COIL.rOut + 1.4, M.phenolic, L("Coil cheek", "", "Keeps the winding square."));
  live.coil = ringX("coil", COIL.s0, COIL.s1, BARREL.y, BARREL.z, BARREL.r + 0.05, COIL.rOut, M.enamel.clone(), L("Drive coil", "100 µH, 60 mm, 1.6 mm wire", "Pulls the slug toward its centre while current flows. L, C and wire gauge set the pulse length."), { segs: 64 });
  for (let s = COIL.s0 + 1.2; s < COIL.s1 - 0.4; s += 1.5) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(COIL.rOut + 0.02, 0.16, 8, 64), M.copper);
    t.rotation.y = Math.PI / 2;
    t.position.copy(W(s, BARREL.y, BARREL.z));
    groups.coil.add(t);
  }
  // coil field: nested glow shells, driven by the current squared
  live.field = [];
  for (const [r, len, op] of [[COIL.rOut + 2.5, (COIL.s1 - COIL.s0) + 4, 0.16], [COIL.rOut + 6.5, (COIL.s1 - COIL.s0) + 12, 0.09], [COIL.rOut + 12, (COIL.s1 - COIL.s0) + 22, 0.045]]) {
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 32), new THREE.MeshBasicMaterial({ color: 0x5a7cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    g.rotation.z = Math.PI / 2;
    g.position.copy(W((COIL.s0 + COIL.s1) / 2, BARREL.y, BARREL.z));
    g.userData.peak = op;
    g.renderOrder = 6;
    groups.coil.add(g);
    live.field.push(g);
  }
  const TB = { x0: 78, x1: 112, y0: 44, y1: 56, z1: 6 };
  box("coil", [TB.x0, TB.y0, 0], [TB.x1, TB.y1, TB.z1], M.absLight, L("Coil terminal block", "", "Two bridged groups: feed, coil lead and diode on each side."));
  const TB_T = { a1: [83, 47.5], a2: [83, 52.5], ad: [90, 52.5], b1: [107, 47.5], b2: [107, 52.5], bd: [100, 52.5] };
  const termTop = TB.z1 + 2.6;
  for (const [id, [x, y]] of Object.entries(TB_T)) cylZ("coil", x, y, TB.z1, termTop, 1.4, M.brass, null, { segs: 16 });
  box("coil", [81.6, 46.2, TB.z1], [91.4, 53.8, TB.z1 + 0.4], M.brass, null);
  box("coil", [98.6, 46.2, TB.z1], [108.4, 53.8, TB.z1 + 0.4], M.brass, null);
  const term = (id) => [TB_T[id][0], TB_T[id][1], termTop];
  const DIODE_Y = 52.5;
  live.diode = cylX("coil", 92.4, 97.6, DIODE_Y, TB.z1 + 3.5, 3.0, M.diode.clone(), L("Flyback diode", "1200 V, 2 kA surge", "Across the coil. When the bank hits zero the coil's current has nowhere to go but through here; without it the spike kills the SCR on the first shot."), { segs: 32 });
  cylX("coil", 97.6, 98.3, DIODE_Y, TB.z1 + 3.5, 3.0, M.alu, null);
  box("coil", [92.6, DIODE_Y - 1.6, TB.z1], [97.4, DIODE_Y + 1.6, TB.z1 + 0.5], M.chip, null);
  live.emissive.diode = [live.diode];
  const DIODE_A = [91.6, DIODE_Y, TB.z1 + 3.5], DIODE_K = [98.4, DIODE_Y, TB.z1 + 3.5];
  // the slug
  const slugGeo = new THREE.CylinderGeometry(SLUG.r, SLUG.r, SLUG.len - 2.4, 32);
  const slug = new THREE.Group();
  const slugBody = new THREE.Mesh(slugGeo, M.steel);
  slugBody.rotation.z = -Math.PI / 2;
  slug.add(slugBody);
  for (const sgn of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(sgn > 0 ? SLUG.r - 1.2 : SLUG.r, sgn > 0 ? SLUG.r : SLUG.r - 1.2, 1.2, 32), M.steel);
    cap.rotation.z = -Math.PI / 2;
    cap.position.x = sgn * (SLUG.len - 1.2) / 2;
    slug.add(cap);
  }
  slug.children.forEach((m) => { m.castShadow = true; m.userData.label = L("Projectile", "8 g steel, 30 mm", "Starts with its nose at the coil's mouth. Pulled forward until it passes the coil's centre, then pulled back."); m.userData.group = "coil"; pickables.push(m); });
  slug.position.copy(W(SLUG.breech + SLUG.len / 2, BARREL.y, BARREL.z - (BARREL.bore - SLUG.r)));
  slug.userData.home = slug.position.clone();
  groups.coil.add(slug);
  live.slug = slug;
  // force arrow and tracer
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x3ddc84, 3, 2);
  arrow.visible = false;
  groups.coil.add(arrow);
  live.arrow = arrow;
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.0 }));
  groups.coil.add(tracer);
  live.tracer = tracer;

  // ---------------------------------------------------------------- block 5: optical gate and MCU
  ringX("sensing", GATE_X - 2, GATE_X + 2, BARREL.y, BARREL.z, BARREL.r + 0.05, BARREL.r + 3.2, M.abs, L("Optical gate ring", "", "Holds an IR LED above and a photodiode below the bore. When the slug breaks the beam the MCU knows exactly where it is."));
  cylZ("sensing", GATE_X, BARREL.y, BARREL.z + BARREL.r + 3.2, BARREL.z + BARREL.r + 6.8, 2.2, M.abs, L("IR emitter", "940 nm", "Shines across the barrel."), { segs: 24 });
  sphere("sensing", [GATE_X, BARREL.y, BARREL.z + BARREL.r + 7.6], 1.4, M.irLens, null);
  cylZ("sensing", GATE_X, BARREL.y, BARREL.z - BARREL.r - 6.8, BARREL.z - BARREL.r - 3.2, 2.2, M.abs, L("Photodiode", "", "Sees the beam until the slug blocks it. Its edge is the timing reference for the next stage."), { segs: 24 });
  const IR_LEAD = [GATE_X, BARREL.y, BARREL.z + BARREL.r + 8.0];
  const PD_LEAD = [GATE_X, BARREL.y, BARREL.z - BARREL.r - 7.4];
  const MB = { x0: 104, x1: 142, y0: -50, y1: -24, z: 4, t: 1 };
  const mcuTop = MB.z + MB.t;
  for (const [x, y] of [[MB.x0 + 2.5, MB.y0 + 2.5], [MB.x1 - 2.5, MB.y0 + 2.5], [MB.x0 + 2.5, MB.y1 - 2.5], [MB.x1 - 2.5, MB.y1 - 2.5]]) cylZ("sensing", x, y, 0, MB.z, 1, M.brass, null, { segs: 12 });
  box("sensing", [MB.x0, MB.y0, MB.z], [MB.x1, MB.y1, mcuTop], M.pcb, L("Microcontroller board", "", "Reads the optical gates and fires each stage at the right moment. Not needed for a single stage."));
  const mchip = (x, y, len, wid, tall, label) => box("sensing", [x, y, mcuTop], [x + len, y + wid, mcuTop + tall], M.chip, label);
  mchip(112, -42, 10.2, 7.2, 1.4, L("Microcontroller", "", "Timing: gate edge in, gate pulse out. With IGBTs it can also cut each pulse before the slug passes centre."));
  mchip(126, -44, 4.6, 2.4, 1.1, L("Regulator", "", "5 V for the logic."));
  mchip(112, -32, 4.6, 2.4, 1.1, L("EEPROM", "", "Stores stage timings."));
  box("sensing", [126, -36, mcuTop], [130, -34.4, mcuTop + 1.3], M.alu, L("Crystal", "16 MHz", "Timing reference."));
  cylZ("sensing", 134, -42, mcuTop, mcuTop + 3, 1.3, M.canSleeve, null, { segs: 16 });
  const mcuLed = sphere("sensing", [136, -31, mcuTop + 0.5], 0.8, M.ledGreen.clone(), L("Status lamp", "", "On while the controller is powered."));
  live.emissive.mcu = [mcuLed];
  cylZ("sensing", 120, -31, mcuTop, mcuTop + 1.4, 1.1, M.absLight, L("Reset", "", ""), { segs: 12 });
  box("sensing", [MB.x0 - 2, -40, mcuTop], [MB.x0 + 4, -36, mcuTop + 2.2], M.alu, L("USB", "", "Programming and logs."));
  const MCU_FIRE = [MB.x0 + 4, -27, mcuTop];
  box("sensing", [MCU_FIRE[0] - 1.2, MCU_FIRE[1] - 2.4, mcuTop], [MCU_FIRE[0] + 1.2, MCU_FIRE[1] + 2.4, mcuTop + 2.2], M.chip, L("Fire output header", "", "To the gate board's fire input."));
  const MCU_GATE = [MB.x1 - 10, -27, mcuTop];
  box("sensing", [MCU_GATE[0] - 1.2, MCU_GATE[1] - 2.4, mcuTop], [MCU_GATE[0] + 1.2, MCU_GATE[1] + 2.4, mcuTop + 2.2], M.chip, L("Gate input header", "", "IR emitter drive and photodiode sense."));
  box("sensing", [MB.x0 + 8, MB.y0 + 1.2, mcuTop], [MB.x0 + 30, MB.y0 + 3.4, mcuTop + 2.2], M.chip, L("I/O header", "", "Spare pins for later stages."));

  // ---------------------------------------------------------------- key switch
  const KEY = { x0: -140, x1: -126, y0: 30, y1: 44, z1: 6 };
  box("charger", [KEY.x0, KEY.y0, 0], [KEY.x1, KEY.y1, KEY.z1], M.abs, L("Key switch", "", "Power to the charger. Key out means the bleeder is draining the bank."));
  const KEY_C = [(KEY.x0 + KEY.x1) / 2, (KEY.y0 + KEY.y1) / 2];
  cylZ("charger", KEY_C[0], KEY_C[1], KEY.z1, KEY.z1 + 1.2, 3.2, M.steel, null, { segs: 24 });
  cylZ("charger", KEY_C[0], KEY_C[1], KEY.z1 + 1.2, KEY.z1 + 4, 2.4, M.steel, L("Key switch", "", "Power to the charger. Key out means the bleeder is draining the bank."), { segs: 24 });
  const keyPivot = new THREE.Group();
  keyPivot.position.copy(W(KEY_C[0], KEY_C[1], KEY.z1 + 4));
  groups.charger.add(keyPivot);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.2, 1.8), M.steel);
  blade.position.set(2.0, 2.1, 0);
  blade.castShadow = true;
  blade.userData.label = L("Key", "", "Turn it (K) to switch the charger on or off.");
  blade.userData.group = "charger";
  pickables.push(blade);
  keyPivot.add(blade);
  keyPivot.rotation.y = Math.PI / 2;
  live.keyPivot = keyPivot;
  const KEY_TERM = [KEY.x1 - 2.5, KEY.y0 + 2.5, KEY.z1], KEY_TERM2 = [KEY.x1 - 2.5, KEY.y1 - 2.5, KEY.z1];
  for (const c of [KEY_TERM, KEY_TERM2]) cylZ("charger", c[0], c[1], KEY.z1, KEY.z1 + 1.6, 0.9, M.brass, null, { segs: 12 });

  // ---------------------------------------------------------------- cables (the figure's routes)
  const lane = (r) => r * 1.5 + 0.1;
  const SOCKET = [-146, -26];
  const JACK = [-134, CH.y1, 8];
  cable("in.lead", [[SOCKET[0], SOCKET[1], 3.6], [SOCKET[0], SOCKET[1], 6.5], [SOCKET[0], -5.5, 7.5], [JACK[0], -5.5, JACK[2]], [JACK[0], JACK[1] + 2.4, JACK[2]]], 0.7, M.cableBlack, L("Input lead", "12–24 V", "From the bench socket to the charger."), { bend: 3 });
  const KEYLANE_Z = lane(0.45);
  [[KEY_TERM, CH_EN, -0.7, -1.0], [KEY_TERM2, CH_EN2, 0.7, -2.4]].forEach(([from, to, dx, yl], i) =>
    cable(`key.lead${i}`, [[from[0], from[1], KEY.z1 + 1.6], [from[0], from[1], KEY.z1 + 4.5], [-120 + dx, from[1], KEY.z1 + 4.5], [-120 + dx, from[1], KEYLANE_Z], [-120 + dx, 20, KEYLANE_Z], [-120 + dx, yl, KEYLANE_Z], [to[0], yl, KEYLANE_Z], [to[0], yl, CH.z1 + 3.4], [to[0], to[1], CH.z1 + 3.4], [to[0], to[1], CH.z1 + 2.4]], 0.45, M.cableYellow, L("Key switch leads", "", "A low-voltage enable pair: the key never carries the bank."), { bend: 2.4 }));
  cable("chg.pos", [[CH_OUT.pos[0], CH_OUT.pos[1], CH.z1 + 3], [CH_OUT.pos[0], CH_OUT.pos[1], CH.z1 + 6], [CH_OUT.pos[0] + 6, CH_OUT.pos[1] - 6, CH.z1 + 6], [RLIM.x0 - 7, RLIM.y, 12], [RLIM.x0 - 4.5, RLIM.y, RLIM.z], [RLIM.x0, RLIM.y, RLIM.z]], 0.7, M.cableRed, L("Charger + to limit resistor", "", ""), { bend: 3.5 });
  cable("rlim.pos", [[RLIM.x1, RLIM.y, RLIM.z], [RLIM.x1 + 4.5, RLIM.y, RLIM.z], [RLIM.x1 + 7, RLIM.y, 12], [BUS.x0 + 1.5, RLIM.y + 6, busTop + 4], [BUS.x0 + 1.5, BANK.y + busDy("pos"), busTop + 4], busAt("pos", BUS.x0 + 1.5)], 0.7, M.cableRed, L("Limit resistor to + bus", "", ""), { bend: 3.5 });
  cable("chg.neg", [[CH_OUT.neg[0], CH_OUT.neg[1], CH.z1 + 3], [CH_OUT.neg[0], CH_OUT.neg[1], busTop + 3], [BUS.x0 + 1.5, BANK.y + busDy("neg"), busTop + 3], busAt("neg", BUS.x0 + 1.5)], 0.7, M.cableBlack, L("Charger − to − bus", "", ""), { bend: 3.5 });
  cable("bleed.pos", [[BLEED.x0, BLEED.y, BLEED.z], [BLEED.x0 - 4, BLEED.y, BLEED.z], [BLEED.x0 - 4, BLEED.y, busTop + 4.5], [BLEED.x0 - 4, BANK.y + busDy("pos") + 4, busTop + 4.5], [BLEED.x0 - 4, BANK.y + busDy("pos"), busTop + 4.5], busAt("pos", BLEED.x0 - 4)], 0.42, M.cableRed, L("Bleeder lead", "", "To the + bus."), { bend: 2.4 });
  cable("bleed.neg", [[BLEED.x1, BLEED.y, BLEED.z], [BLEED.x1 + 4, BLEED.y, BLEED.z], [BLEED.x1 + 4, BLEED.y, busTop + 3], [BLEED.x1 + 4, BANK.y + busDy("neg") + 4, busTop + 3], [BLEED.x1 + 4, BANK.y + busDy("neg"), busTop + 3], busAt("neg", BLEED.x1 + 4)], 0.42, M.cableBlack, L("Bleeder lead", "", "To the − bus."), { bend: 2.4 });
  const loopLabel = L("Discharge loop", "heavy cable, kiloamps", "The pulse path: + bus → SCR → coil → − bus. Keep it short and fat; every microhenry here slows the pulse.");
  cable("loop.anode", [busAt("pos", BUS.x1 - 2), [BUS.x1 - 2, BANK.y + busDy("pos"), busTop + 6], [BUS.x1 + 6, BANK.y + busDy("pos") + 2, busTop + 6], [SCR_ANODE[0] - 5, SCR.c[1], SCR_ANODE[2] + 7], [SCR_ANODE[0], SCR.c[1], SCR_ANODE[2] + 7], [SCR_ANODE[0], SCR.c[1], SCR_ANODE[2] + 4.8]], 1.1, M.cableRed, loopLabel, { bend: 4.5, hot: "loop" });
  const LOOP_Z = lane(1.1), LANE_A = 22.0, LANE_B = 18.4;
  cable("loop.coil", [[SCR_K[0], SCR_K[1], HS.z1 + 2.2], [SCR_K[0], SCR_K[1], HS.z1 + 7], [-6, SCR_K[1], HS.z1 + 7], [-6, SCR_K[1], LOOP_Z], [-6, LANE_A, LOOP_Z], [76, LANE_A, LOOP_Z], [TB_T.a1[0], 40, LOOP_Z], [TB_T.a1[0], 40, termTop + 3.2], [TB_T.a1[0], TB_T.a1[1], termTop + 3.2], term("a1")], 1.1, M.cableRed, loopLabel, { bend: 4.5, hot: "loop" });
  cable("loop.return", [term("b1"), [TB_T.b1[0], TB_T.b1[1], termTop + 3.2], [TB_T.b1[0], 40, termTop + 3.2], [TB_T.b1[0], 40, LOOP_Z], [116, 34, LOOP_Z], [116, LANE_B, LOOP_Z], [-2, LANE_B, LOOP_Z], [-2, BANK.y + busDy("neg") + 5, LOOP_Z], [-2, BANK.y + busDy("neg") + 5, busTop + 3], [BUS.x1 - 2, BANK.y + busDy("neg") + 2, busTop + 3], [BUS.x1 - 2, BANK.y + busDy("neg"), busTop + 3], busAt("neg", BUS.x1 - 2)], 1.1, M.cableBlack, loopLabel, { bend: 4.5, hot: "loop" });
  const COIL_LUG = [[COIL.s0 - 1.1, BARREL.y, BARREL.z - COIL.rOut - 1.4], [COIL.s1 + 1.1, BARREL.y, BARREL.z - COIL.rOut - 1.4]];
  cable("coil.leadA", [COIL_LUG[0], [COIL_LUG[0][0], COIL_LUG[0][1], 10], [TB.x0 - 2, 40, 10], [TB.x0 - 2, TB_T.a2[1], 10], [TB_T.a2[0], TB_T.a2[1], 10], term("a2")], 0.8, M.enamel, L("Coil lead", "", "The winding's own wire, down to the block."), { bend: 3, hot: "loop" });
  cable("coil.leadB", [COIL_LUG[1], [COIL_LUG[1][0], COIL_LUG[1][1], 10], [TB.x1 + 2, 40, 10], [TB.x1 + 2, TB_T.b2[1], 10], [TB_T.b2[0], TB_T.b2[1], 10], term("b2")], 0.8, M.enamel, L("Coil lead", "", "The winding's own wire, down to the block."), { bend: 3, hot: "loop" });
  cable("diode.leadA", [DIODE_A, [TB_T.ad[0] + 0.3, DIODE_Y, DIODE_A[2]], [TB_T.ad[0], DIODE_Y, DIODE_A[2]], [TB_T.ad[0], DIODE_Y, termTop]], 0.45, M.cableGrey, L("Diode lead", "", ""), { bend: 1.4, hot: "diode" });
  cable("diode.leadK", [DIODE_K, [TB_T.bd[0] - 0.3, DIODE_Y, DIODE_K[2]], [TB_T.bd[0], DIODE_Y, DIODE_K[2]], [TB_T.bd[0], DIODE_Y, termTop]], 0.45, M.cableGrey, L("Diode lead", "", ""), { bend: 1.4, hot: "diode" });
  cable("gate.lead", [[GATE_OUT[0], GATE_OUT[1], gateTop + 2.2], [GATE_OUT[0], GATE_OUT[1], gateTop + 5], [GATE_OUT[0], -9, gateTop + 5], [SCR_GATE[0], -9, HS.z1 + 4.4], [SCR_GATE[0], SCR_GATE[1], HS.z1 + 4.4], [SCR_GATE[0], SCR_GATE[1], SCR_GATE[2]]], 0.42, M.cableBlue, L("Gate lead", "", "The trigger pulse to the SCR's gate."), { bend: 2.4, hot: "gate" });
  const SIG_Z = lane(0.45);
  cable("mcu.fire", [[MCU_FIRE[0], MCU_FIRE[1], mcuTop + 2.2], [MCU_FIRE[0], MCU_FIRE[1], mcuTop + 5], [MCU_FIRE[0], -16, mcuTop + 5], [MCU_FIRE[0], -16, SIG_Z], [48, -16, SIG_Z], [48, GATE_IN[1], SIG_Z], [48, GATE_IN[1], gateTop + 3.6], [GATE_IN[0] + 3, GATE_IN[1], gateTop + 3.6], [GATE_IN[0], GATE_IN[1], gateTop + 3.6], [GATE_IN[0], GATE_IN[1], gateTop + 2.2]], 0.45, M.cableGrey, L("MCU fire line", "", "Later stages fire from here instead of the button."), { bend: 2.6 });
  const MG = (dy, z) => [MCU_GATE[0] + dy, MCU_GATE[1] + (dy < 0 ? 1.2 : -1.2), z];
  cable("gate.ir.lead", [IR_LEAD, [IR_LEAD[0], IR_LEAD[1], IR_LEAD[2] + 3], [138, 20, IR_LEAD[2] + 3], [138, 20, 10], [138, -18, 10], [MG(-0.8, 10)[0], -22, 10], MG(-0.8, 10), MG(-0.8, mcuTop + 2.2)], 0.42, M.cableGrey, L("IR emitter lead", "", ""), { bend: 2.4 });
  cable("gate.pd.lead", [PD_LEAD, [PD_LEAD[0], PD_LEAD[1], PD_LEAD[2] - 2], [142, 22, PD_LEAD[2] - 2], [142, 22, 4], [142, -18, 4], [MG(0.8, 4)[0] + 1.2, -22, 9.5], MG(0.8, 10), MG(0.8, mcuTop + 2.2)], 0.42, M.cableGrey, L("Photodiode lead", "", ""), { bend: 2.4 });

  // cable clamps on studs
  for (const [x, y, along, r, z] of [[-120, 8, "y", 1.6, KEYLANE_Z], [-6, 4, "y", 1.7, LOOP_Z], [60, LANE_A, "x", 1.7, LOOP_Z], [20, LANE_B, "x", 1.7, LOOP_Z], [96, LANE_B, "x", 1.7, LOOP_Z], [74, -16, "x", 1.05, SIG_Z]]) {
    cylZ("cables", x, y, 0, Math.max(0.4, z - r + 0.6), 0.9, M.steel, null, { segs: 12 });
    const c = along === "x" ? cylX("cables", x - 0.9, x + 0.9, y, z, r, M.abs, L("Cable clamp", "", "")) : cylY("cables", x, y - 0.9, y + 0.9, z, r, M.abs, L("Cable clamp", "", ""));
  }

  // ---------------------------------------------------------------- group anchors for labels, homes for the explode
  const anchors = {
    charger: W(-123, -28, 34), bank: W(-48, -30, 36), switch: W(20, -22, 24), coil: W(95, 32, 44), sensing: W(123, -37, 14), bench: W(-100, 50, 8),
  };
  for (const [id, g] of Object.entries(groups)) g.userData.explode = new THREE.Vector3(...GROUP_INFO[id].explode).set(GROUP_INFO[id].explode[0], GROUP_INFO[id].explode[2], GROUP_INFO[id].explode[1]);

  return { THREE, renderer, scene, camera, controls, groups, GROUP_INFO, anchors, pickables, live, materials: M, layout: { PLATE, BARREL, COIL, GATE_X, CATCH, SLUG, SCALE, METER, KNOB }, W, sun, hemi, fill };
}
