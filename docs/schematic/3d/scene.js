// The 3D bench, built from the Coilgun build guide (the Claude Doc), part for part and name for name.
// Units are millimetres. Coordinates: x along the bench (breech at the left, muzzle at the right),
// y toward the viewer, z up from the bench top. W() maps them into Three.js (y up).
// Everything hoverable carries userData.label = { name, value, role } in the guide's words.
// Parts the guide marks as "later" (week 6+) are tagged userData.later and hidden until the
// upgrade toggle is on; the push switch is tagged userData.early and hidden when it is on.

function buildScene(THREE, OrbitControls, MODEL, canvas) {
  const W = (x, y, z) => new THREE.Vector3(x, z, y);

  // ---------------------------------------------------------------- renderer, camera, lights
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1.6, 2, 8000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 60;
  controls.maxDistance = 2600;

  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a3630, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
  sun.position.copy(W(-300, 380, 900));
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -700, right: 700, top: 500, bottom: -500, near: 100, far: 2200 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 1.2;
  sun.target.position.copy(W(100, -20, 0));
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.6);
  fill.position.copy(W(900, -600, 400));
  scene.add(fill);

  // ---------------------------------------------------------------- materials
  const std = (color, { metalness = 0, roughness = 0.6, ...rest } = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...rest });
  const M = {
    benchWood: std(0x8a6a48, { roughness: 0.8 }),
    plywood: std(0xd2b48a, { roughness: 0.85 }),
    plywoodEdge: std(0xb89566, { roughness: 0.85 }),
    steel: std(0x9aa0a8, { metalness: 0.95, roughness: 0.28 }),
    zinc: std(0xb8bcc2, { metalness: 0.85, roughness: 0.35 }),
    brass: std(0xc9a44a, { metalness: 0.9, roughness: 0.32 }),
    copper: std(0xb87333, { metalness: 0.92, roughness: 0.3 }),
    enamel: std(0xc8742c, { metalness: 0.75, roughness: 0.42 }),
    alu: std(0xbfc4cb, { metalness: 0.8, roughness: 0.35 }),
    blackPlastic: std(0x18191c, { roughness: 0.5 }),
    greyPlastic: std(0x4a4f58, { roughness: 0.55 }),
    lightPlastic: std(0xd9d6cf, { roughness: 0.6 }),
    supplyCase: std(0x2c3036, { roughness: 0.45, metalness: 0.2 }),
    supplyPanel: std(0x1b1d21, { roughness: 0.5 }),
    pla: std(0x3d7be0, { roughness: 0.55 }),
    capSleeve: std(0x14306b, { roughness: 0.5 }),
    capTop: std(0xd8d2c4, { metalness: 0.5, roughness: 0.4 }),
    capStripe: std(0xe8e4d8, { roughness: 0.6 }),
    slate: std(0x2e3338, { roughness: 0.8 }),
    ceramic: std(0xece7da, { roughness: 0.85 }),
    diodeBody: std(0x1a1a1c, { roughness: 0.4 }),
    band: std(0xf2f0e8, { roughness: 0.5 }),
    green: std(0x2f9e4f, { roughness: 0.4 }),
    red: std(0xc0392b, { roughness: 0.45 }),
    tapeBlue: std(0x2d6cdf, { roughness: 0.7 }),
    tapeYellow: std(0xe0b32e, { roughness: 0.7 }),
    tapeWhite: std(0xefeee9, { roughness: 0.8 }),
    acrylic: new THREE.MeshPhysicalMaterial({ color: 0xd6e6ef, transparent: true, opacity: 0.32, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide, depthWrite: false }),
    cardboard: std(0xb08a5a, { roughness: 0.95 }),
    towel1: std(0x6f8fa8, { roughness: 1 }),
    towel2: std(0xa8746f, { roughness: 1 }),
    towel3: std(0xc9c0a8, { roughness: 1 }),
    cableRed: std(0xc0392b, { roughness: 0.75 }),
    cableBlack: std(0x1d1e21, { roughness: 0.75 }),
    cableBlue: std(0x2d6cdf, { roughness: 0.75 }),
    tinned: std(0xc7cbd0, { metalness: 0.85, roughness: 0.35 }),
    pcb: std(0x1f6b3a, { roughness: 0.6 }),
    pcbBlue: std(0x1e4fa3, { roughness: 0.6 }),
    chip: std(0x111214, { roughness: 0.5 }),
    nylon: std(0xeeeae0, { roughness: 0.7 }),
    rubber: std(0x202226, { roughness: 0.95 }),
    battery: std(0x2b2b2b, { roughness: 0.5 }),
    batteryTop: std(0xd0a33a, { metalness: 0.6, roughness: 0.4 }),
    glassLens: new THREE.MeshPhysicalMaterial({ color: 0xe8f0f4, transparent: true, opacity: 0.35, roughness: 0.05 }),
    meterCase: std(0xe6b422, { roughness: 0.6 }),
    meterFace: std(0x222428, { roughness: 0.5 }),
    led: std(0x4a1a1a, { roughness: 0.3 }),
    irLens: std(0x3a2a44, { roughness: 0.2 }),
  };

  // ---------------------------------------------------------------- groups (the guide's tabs)
  const GROUP_INFO = {
    bench: { title: "Bench and base plate", explode: [0, 0, 0] },
    charging: { title: "1 · Charging", explode: [90, -60, 70] },
    bank: { title: "2 · Capacitor bank", explode: [30, 20, 110] },
    switch: { title: "3 · Switch", explode: [-60, 50, 80] },
    coil: { title: "4 · Coil, barrel, slug", explode: [-20, -70, 90] },
    sensing: { title: "5 · Sensing (later)", explode: [40, -80, 130] },
    pcb: { title: "PCB boards (KiCad)", explode: [-90, 40, 90] },
    tools: { title: "Tools and safety", explode: [0, 70, 40] },
    wiring: { title: "Pulse wiring", explode: [0, 0, 0] },
  };
  const groups = {};
  for (const id of Object.keys(GROUP_INFO)) {
    const g = new THREE.Group();
    g.name = id;
    g.userData.explode = new THREE.Vector3(GROUP_INFO[id].explode[0], GROUP_INFO[id].explode[2], GROUP_INFO[id].explode[1]);
    scene.add(g);
    groups[id] = g;
  }
  const pickables = [];
  const live = { emissive: {}, cables: [], later: [], early: [] };
  let tag = null; // "later" | "early" | null: applied to everything added while set
  const tagged = (fn, t) => { const before = tag; tag = t; try { return fn(); } finally { tag = before; } };

  function add(group, obj, label, { shadow = true, pick = true, parent } = {}) {
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = shadow; } });
    if (label) {
      const lab = typeof label === "string" ? { name: label } : label;
      obj.traverse((o) => { if (o.isMesh) { o.userData.label = lab; o.userData.group = group; if (pick) pickables.push(o); } });
    }
    if (tag === "later") { obj.userData.later = true; live.later.push(obj); }
    if (tag === "early") { obj.userData.early = true; live.early.push(obj); }
    (parent ?? groups[group]).add(obj);
    return obj;
  }
  const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
  const box = (group, [x0, y0, z0], [x1, y1, z1], mat, label, opts) => {
    const m = mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat);
    m.position.copy(W((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    return add(group, m, label, opts);
  };
  const cylZ = (group, x, y, z0, z1, r, mat, label, { segs = 32, r0, opts } = {}) => {
    const m = mesh(new THREE.CylinderGeometry(r, r0 ?? r, z1 - z0, segs), mat);
    m.position.copy(W(x, y, (z0 + z1) / 2));
    return add(group, m, label, opts);
  };
  const cylX = (group, x0, x1, y, z, r, mat, label, { segs = 32, r1, opts } = {}) => {
    const m = mesh(new THREE.CylinderGeometry(r1 ?? r, r, x1 - x0, segs), mat);
    m.rotation.z = -Math.PI / 2;
    m.position.copy(W((x0 + x1) / 2, y, z));
    return add(group, m, label, opts);
  };
  const cylY = (group, x, y0, y1, z, r, mat, label, { segs = 32, opts } = {}) => {
    const m = mesh(new THREE.CylinderGeometry(r, r, y1 - y0, segs), mat);
    m.rotation.x = Math.PI / 2;
    m.position.copy(W(x, (y0 + y1) / 2, z));
    return add(group, m, label, opts);
  };
  const ringX = (group, x0, x1, y, z, rIn, rOut, mat, label, { segs = 64, shadow = true } = {}) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: segs });
    geo.rotateY(Math.PI / 2);
    const m = mesh(geo, mat);
    m.position.copy(W(x0, y, z));
    return add(group, m, label, { shadow });
  };
  const sphere = (group, [x, y, z], r, mat, label) => {
    const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat);
    m.position.copy(W(x, y, z));
    return add(group, m, label);
  };
  function routeCurve(points, bend) {
    const pts = points.map((p) => (p.isVector3 ? p : W(...p)));
    const path = new THREE.CurvePath();
    let prev = pts[0];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const r = Math.min(bend, b.distanceTo(a) * 0.48, b.distanceTo(c) * 0.48);
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
  function cable(group, points, r, mat, label, { bend = 4, hot = false, lugs = [true, true] } = {}) {
    const curve = routeCurve(points, Math.max(bend, r * 2.5));
    const m = mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(curve.getLength() / 2)), r, 12, false), mat.clone());
    add(group, m, label);
    live.cables.push(m);
    if (hot) (live.emissive[hot] ??= []).push(m);
    lugs.forEach((on, i) => {
      if (!on) return;
      const p = i ? points[points.length - 1] : points[0];
      add(group, mesh(new THREE.CylinderGeometry(r * 1.6, r * 1.6, 1.2, 16), M.tinned), null).position.copy(p.isVector3 ? p : W(p[0], p[1], p[2]));
    });
    return m;
  }
  // a lit text panel drawn on a canvas (supply display, multimeter display)
  function panel(group, w, h, px, label) {
    const cv = document.createElement("canvas");
    cv.width = px;
    cv.height = Math.round((px * h) / w);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    add(group, m, label, { shadow: false });
    return { mesh: m, ctx: cv.getContext("2d"), cv, tex, last: "" };
  }
  const L = (name, value, role) => ({ name, value, role });

  // ---------------------------------------------------------------- layout (mm, from the guide)
  const PZ = 6; // base plate top: 300 × 150 mm plywood, 6 mm thick
  const PLATE = { x0: -150, x1: 150, y0: -75, y1: 75 };
  const TUBE = { x0: -150, x1: 150, y: -40, z: PZ + 25 + 8, r: 8, bore: 6 }; // 16 mm OD, 12 mm ID, 25 mm above the plate
  const COIL = { x0: -110, x1: -70, rOut: 8 + 4 * 1.6, cheekR: 20, cheekT: 4 }; // 40 mm long, 4 cm from the breech, 4 layers
  const SLUG = { r: 5, len: 30, z: TUBE.z - (TUBE.bore - 5) };
  const BREECH = TUBE.x0;
  const TB = { x0: 82, x1: 98, y0: 9, y1: 57, xL: 86, xR: 94, ys: [15, 27, 39, 51], top: PZ + 14 };
  const scr = (side, pos) => [side === "L" ? TB.xL : TB.xR, TB.ys[pos - 1], TB.top + 1.5];
  const CAPS = [{ id: "C1", x: 60.5, y: 33 }, { id: "C2", x: 119.5, y: 33 }];
  const CAP = { r: 17.5, z0: PZ + 3, h: 60 };
  const KNIFE = { x0: 88, x1: 143, y0: 55, y1: 73, hingeX: 136, jawX: 95, y: 64, top: PZ + 8 };
  const BDIODE = { x: 144, y: -2 };
  const CTB = { x0: -105, x1: -75, y0: -15, y1: -1, A: [-98, -8], B: [-82, -8], top: PZ + 12 };
  const PSW = { x0: -112, x1: -72, y0: 30, y1: 60, top: PZ + 28 };
  const E_IN = [-72, 52, PZ + 12];
  const E_OUT = [-72, 38, PZ + 12];
  const SUPPLY = { x0: 60, x1: 170, y0: -320, y1: -120, h: 120 };
  const CATCH = { x0: 450, x1: 630, y0: -150, y1: 70, h: 170 };
  const GATES = [0, 50];
  const SCALE = 1000; // world mm per model metre

  // ---------------------------------------------------------------- bench and base plate
  box("bench", [-420, -340, -40], [720, 260, 0], M.benchWood, L("Workbench", "", "Everything sits on the bench; the bench power supply sits beside the base plate, never on it."));
  for (const [x, y] of [[-390, -310], [690, -310], [-390, 230], [690, 230]]) box("bench", [x - 30, y - 30, -420], [x + 30, y + 30, -40], M.benchWood, null);
  box("bench", [PLATE.x0, PLATE.y0, 0], [PLATE.x1, PLATE.y1, PZ], M.plywood, L("Base plate", "300 × 150 mm plywood, 6 mm", "Everything on the plate bolts to it. Plywood is fine and cheaper: nothing on the plate is hot or high voltage."));
  for (const [x, y] of [[-144, -69], [144, -69], [-144, 69], [144, 69]]) cylZ("bench", x, y, PZ, PZ + 0.8, 2.6, M.zinc, null, { segs: 6 });

  // ---------------------------------------------------------------- 1 · Charging
  box("charging", [SUPPLY.x0, SUPPLY.y0, 0], [SUPPLY.x1, SUPPLY.y1, SUPPLY.h], M.supplyCase, L("Bench power supply", "Jesverty SPS-12003N, 0–120 V, 0–3 A", "Set to 55 V and a 1 A current limit. The current knob controls how fast the bank fills. Never above 55 V with 63 V capacitors."));
  box("charging", [SUPPLY.x0 + 4, SUPPLY.y1 - 1, 6], [SUPPLY.x1 - 4, SUPPLY.y1 + 0.5, SUPPLY.h - 6], M.supplyPanel, null);
  const supplyDisplay = panel("charging", 92, 40, 512, L("Supply display", "volts and amps", "Shows the bank's voltage only while the supply is connected. Reads the charging current: 1 A while filling, then the bleeder's 55 mA."));
  supplyDisplay.mesh.position.copy(W((SUPPLY.x0 + SUPPLY.x1) / 2, SUPPLY.y1 + 0.7, 88));
  live.supplyDisplay = supplyDisplay;
  const knobV = cylY("charging", SUPPLY.x0 + 24, SUPPLY.y1, SUPPLY.y1 + 10, 44, 8, M.blackPlastic, L("Voltage knob (taped at 55 V)", "", "Set with nothing connected, then taped so nobody can turn it past 55 V."), { segs: 28 });
  box("charging", [SUPPLY.x0 + 14, SUPPLY.y1 + 9.6, 42], [SUPPLY.x0 + 34, SUPPLY.y1 + 10.6, 46], M.tapeWhite, null);
  cylY("charging", SUPPLY.x0 + 52, SUPPLY.y1, SUPPLY.y1 + 10, 44, 8, M.blackPlastic, L("Current-limit knob", "1.0 A", "Fully down, short the leads, turn up until the display reads 1.0 A, remove the short."), { segs: 28 });
  const outBtn = box("charging", [SUPPLY.x0 + 64, SUPPLY.y1, 16], [SUPPLY.x0 + 84, SUPPLY.y1 + 5, 26], M.green.clone(), L("Supply output button", "", "Turns the supply's output on and off (S)."));
  live.outBtn = outBtn;
  cylY("charging", 150, SUPPLY.y1, SUPPLY.y1 + 12, 25, 4, M.red, L("Supply + terminal (red)", "", "Red is +, black is −, everywhere on the bench."), { segs: 20 });
  cylY("charging", 133, SUPPLY.y1, SUPPLY.y1 + 12, 25, 4, M.blackPlastic, L("Supply − terminal (black)", "", "Red is +, black is −, everywhere on the bench."), { segs: 20 });
  const supplyLeadRed = L("Supply + lead", "18 AWG red", "Supply + to the blocking diode. Banana plug at the supply, ring lug at the diode.");
  const supplyLeadBlack = L("Supply − lead", "18 AWG black", "Supply − straight to the bank's − bus on the terminal block.");
  cable("charging", [[150, SUPPLY.y1 + 12, 25], [150, -106, 25], [150, -97, 1.4], [146, -84, 1.4], [146, -77, PZ + 1.3], [146, -14, PZ + 1.3], [139, -6, PZ + 1.3], [138, -2, PZ + 5]], 1.2, M.cableRed, supplyLeadRed, { bend: 6 });
  cable("charging", [[133, SUPPLY.y1 + 12, 25], [133, -106, 25], [133, -97, 1.4], [133, -80, 1.4], [133, -77, PZ + 1.3], [133, -12, PZ + 1.3], [TB.xR, -12, PZ + 1.3], [TB.xR, 8, PZ + 3], scr("R", 1)], 1.2, M.cableBlack, supplyLeadBlack, { bend: 6 });
  // blocking diode: stud on an insulating block, band (cathode) toward the bank
  const bdLabel = L("Blocking diode", "200 V or more, 50 A or more", "A one-way valve in the + lead: current flows from the supply to the bank, never back. Band toward the capacitors.");
  box("charging", [BDIODE.x - 7, BDIODE.y - 7, PZ], [BDIODE.x + 7, BDIODE.y + 7, PZ + 4], M.blackPlastic, bdLabel);
  cylZ("charging", BDIODE.x, BDIODE.y, PZ + 4, PZ + 8, 6, M.zinc, bdLabel, { segs: 6 });
  cylZ("charging", BDIODE.x, BDIODE.y, PZ + 8, PZ + 20, 4.5, M.diodeBody, bdLabel, { segs: 24 });
  cylZ("charging", BDIODE.x, BDIODE.y, PZ + 16, PZ + 18, 4.55, M.band, bdLabel, { segs: 24 });
  box("charging", [BDIODE.x - 1.5, BDIODE.y - 3, PZ + 20], [BDIODE.x + 1.5, BDIODE.y + 3, PZ + 24], M.brass, bdLabel);
  // knife switch: the disconnect
  const knifeLabel = L("Disconnect switch (knife switch)", "in the + lead, diode → bank", "Opened with the bank full and no current flowing, so the supply is off the bank before you fire. Never used to fire. K opens and closes it.");
  box("charging", [KNIFE.x0, KNIFE.y0, PZ], [KNIFE.x1, KNIFE.y1, KNIFE.top], M.slate, knifeLabel);
  for (const x of [KNIFE.hingeX, KNIFE.jawX]) {
    box("charging", [x - 4, KNIFE.y - 6, KNIFE.top], [x + 4, KNIFE.y - 4.6, KNIFE.top + 12], M.copper, knifeLabel);
    box("charging", [x - 4, KNIFE.y + 4.6, KNIFE.top], [x + 4, KNIFE.y + 6, KNIFE.top + 12], M.copper, knifeLabel);
    box("charging", [x - 4, KNIFE.y - 6, KNIFE.top], [x + 4, KNIFE.y + 6, KNIFE.top + 1.5], M.copper, knifeLabel);
  }
  const knifePivot = new THREE.Group();
  knifePivot.position.copy(W(KNIFE.hingeX, KNIFE.y, KNIFE.top + 8));
  groups.charging.add(knifePivot);
  const blade = mesh(new THREE.BoxGeometry(48, 9, 2.6), M.copper);
  blade.position.set(-24, 0, 0);
  const handle = mesh(new THREE.CylinderGeometry(3.4, 3.4, 22, 20), M.blackPlastic);
  handle.position.set(-50, 6, 0);
  add("charging", blade, knifeLabel, { parent: knifePivot });
  add("charging", handle, knifeLabel, { parent: knifePivot });
  live.knifePivot = knifePivot;
  cable("charging", [[BDIODE.x, BDIODE.y + 2, PZ + 23], [BDIODE.x + 1, 10, PZ + 26], [145.5, 46, PZ + 14], [141, KNIFE.y, PZ + 10]], 1.2, M.cableRed, L("Diode to disconnect switch", "18 AWG red", ""), { bend: 6 });
  cable("charging", [[KNIFE.jawX - 4, KNIFE.y - 4, PZ + 9], [TB.xR + 2, 56, PZ + 12], scr("R", 4)], 1.2, M.cableRed, L("Disconnect switch to bank +", "18 AWG red", "Charge current enters the + bus here."), { bend: 3 });

  // ---------------------------------------------------------------- 2 · Capacitor bank
  live.cans = [];
  for (const c of CAPS) {
    const capLabel = L(`Capacitor ${c.id}`, "10 000 µF, 63 V electrolytic", "Two in parallel make 20 000 µF: 30 J at 55 V. The stripe terminal is negative and goes to the − bus. Both face the same way.");
    cylZ("bank", c.x, c.y, PZ, CAP.z0, CAP.r + 2.5, M.pla, L("Cradle", "3D-printed", "Holds the can upright. Loose cans walk under the pulse's magnetic kick."), { segs: 40 });
    live.cans.push(cylZ("bank", c.x, c.y, CAP.z0, CAP.z0 + CAP.h, CAP.r, M.capSleeve, capLabel, { segs: 48 }));
    cylZ("bank", c.x, c.y, CAP.z0 + CAP.h, CAP.z0 + CAP.h + 1.2, CAP.r - 0.5, M.capTop, capLabel, { segs: 48 });
    const toward = c.x < TB.xL ? 1 : -1; // stripe faces the terminal block
    const stripe = box("bank", [-2.2, -0.4, CAP.z0 + 4], [2.2, 0.4, CAP.z0 + CAP.h - 4], M.capStripe, capLabel);
    stripe.position.copy(W(c.x + toward * CAP.r * 0.72, c.y - CAP.r * 0.7, CAP.z0 + CAP.h / 2));
    stripe.rotation.y = toward > 0 ? Math.PI / 4 : -Math.PI / 4;
    for (const [dy, mat] of [[7, M.brass], [-7, M.brass]]) cylZ("bank", c.x, c.y + dy, CAP.z0 + CAP.h + 1.2, CAP.z0 + CAP.h + 4, 2.8, mat, capLabel, { segs: 6 });
  }
  const tbLabel = L("Terminal block", "4-way barrier strip, 30 A", "Screws 1–2 are the − bus, 3–4 the + bus. Everything positive meets on +, everything negative on −.");
  box("bank", [TB.x0, TB.y0, PZ], [TB.x1, TB.y1, TB.top], M.blackPlastic, tbLabel);
  for (const y of [TB.y0 + 0.5, ...TB.ys.slice(0, 3).map((v) => v + 6), TB.y1 - 1.5]) box("bank", [TB.x0, y - 0.5, TB.top], [TB.x1, y + 0.5, TB.top + 4], M.blackPlastic, tbLabel);
  for (const y of TB.ys) for (const x of [TB.xL, TB.xR]) cylZ("bank", x, y, TB.top, TB.top + 1.6, 2.6, M.zinc, tbLabel, { segs: 16 });
  box("bank", [TB.xR - 3, TB.ys[0] - 3, TB.top + 1.6], [TB.xR + 3, TB.ys[1] + 3, TB.top + 2.2], M.brass, L("− bus jumper", "", "Joins screws 1 and 2."));
  box("bank", [TB.xR - 3, TB.ys[2] - 3, TB.top + 1.6], [TB.xR + 3, TB.ys[3] + 3, TB.top + 2.2], M.brass, L("+ bus jumper", "", "Joins screws 3 and 4."));
  const jumperLabel = (id, s) => L(`${id} ${s} jumper`, "10 AWG, under 10 cm", "Short jumpers from each capacitor to the bus. The pulse hates long wire.");
  for (const c of CAPS) {
    const side = c.x < TB.xL ? "L" : "R";
    const xs = side === "L" ? TB.xL - 6 : TB.xR + 6;
    const tz = CAP.z0 + CAP.h + 4;
    cable("bank", [[c.x, c.y + 7, tz], [c.x, c.y + 7, tz + 6], [xs, TB.ys[2], tz + 6], [xs, TB.ys[2], TB.top + 2], scr(side, 3)], 2.2, M.cableRed, jumperLabel(c.id, "+"), { bend: 5 });
    cable("bank", [[c.x, c.y - 7, tz], [c.x, c.y - 7, tz + 10], [xs, TB.ys[1], tz + 10], [xs, TB.ys[1], TB.top + 2], scr(side, 2)], 2.2, M.cableBlack, jumperLabel(c.id, "−"), { bend: 5 });
  }
  const bleedLabel = L("Bleeder resistor", "1 kΩ, 10 W wirewound", "Permanently across the bank, screws 1 and 4. Drains it whenever the supply is off: 55 V to under 5 V in about 50 s.");
  const bleedZ = TB.top + 9;
  live.bleeder = box("bank", [TB.xL - 4.5, TB.ys[0] + 3, bleedZ - 4.5], [TB.xL + 4.5, TB.ys[3] - 3, bleedZ + 4.5], M.ceramic.clone(), bleedLabel);
  for (const y of [TB.ys[0], TB.ys[3]]) cable("bank", [[TB.xL, y + (y < 30 ? 3 : -3), bleedZ], [TB.xL, y, bleedZ], [TB.xL, y, TB.top + 1.6]], 0.5, M.tinned, bleedLabel, { bend: 1.5, lugs: [false, false] });

  // ---------------------------------------------------------------- 3 · Switch
  const pswLabel = L("Push switch", "Baomain double safety switch", "Press the green button (normally open) firmly and quickly: it connects the bank to the coil. Bolted at the far end from the capacitors.");
  tagged(() => {
    box("switch", [PSW.x0, PSW.y0, PZ], [PSW.x1, PSW.y1, PSW.top], M.lightPlastic, pswLabel);
    live.fireBtn = cylZ("switch", -100, 45, PSW.top, PSW.top + 6, 6.5, M.green.clone(), L("Fire button (green)", "", "Space fires. A slow, hesitant press makes a longer spark."), { segs: 28 });
    live.fireBtn.userData.rest = live.fireBtn.position.clone();
    cylZ("switch", -100, 45, PSW.top, PSW.top + 1.4, 9, M.greyPlastic, pswLabel, { segs: 28 });
    cylZ("switch", -84, 45, PSW.top, PSW.top + 6, 6.5, M.red, L("Stop button (red)", "", "Not used here; only the green, normally-open pair is wired."), { segs: 28 });
    for (const e of [E_IN, E_OUT]) cylX("switch", PSW.x1, PSW.x1 + 3, e[1], e[2], 2.6, M.brass, pswLabel, { segs: 12 });
  }, "early");
  // flyback diode on its bracket beside the coil's terminal block
  const fdLabel = L("Flyback diode", "200 V or more, 50 A or more", "Straight across the coil. Blocks during the shot; when the bank runs out it carries the coil's leftover current so the spike never reaches the capacitors or the switch. Band toward plus.");
  box("switch", [-130, -14, PZ], [-112, -2, PZ + 3], M.alu, L("Diode bracket", "aluminium", "Holds and cools the flyback diode."));
  cylZ("switch", -121, -8, PZ + 3, PZ + 7, 6, M.zinc, fdLabel, { segs: 6 });
  live.flyback = cylZ("switch", -121, -8, PZ + 7, PZ + 19, 4.5, M.diodeBody.clone(), fdLabel, { segs: 24 });
  cylZ("switch", -121, -8, PZ + 15, PZ + 17, 4.55, M.band, fdLabel, { segs: 24 });
  live.emissive.diode = [live.flyback];
  cable("switch", [[-121, -8, PZ + 19], [-121, -8, PZ + 24], [CTB.A[0], CTB.A[1] - 3, CTB.top + 6], [CTB.A[0], CTB.A[1] - 3, CTB.top + 1.5]], 1.0, M.copper, L("Flyback diode lead (band end)", "", "To the coil terminal fed from the + side."), { bend: 3, hot: "diode" });
  cable("switch", [[-113, -6, PZ + 2], [-108, -6, PZ + 3], [CTB.B[0], CTB.B[1] - 3, CTB.top + 4], [CTB.B[0], CTB.B[1] - 3, CTB.top + 1.5]], 1.0, M.copper, L("Flyback diode lead (plain end)", "", "To the coil terminal that returns to the − bus."), { bend: 3, hot: "diode" });

  // ---------------------------------------------------------------- 4 · Coil, barrel, slug
  const saddleLabel = L("Stand (V-block)", "3D-printed", "Holds the tube 25 mm above the base plate. A zip tie over the tube stops it rolling.");
  for (const [x0, x1] of [[-146, -134], [108, 120]]) {
    box("coil", [x0, TUBE.y - 18, PZ], [x1, TUBE.y + 18, TUBE.z - TUBE.r], M.pla, saddleLabel);
    for (const s of [-1, 1]) box("coil", [x0, TUBE.y + s * 12 - 3, TUBE.z - TUBE.r], [x1, TUBE.y + s * 12 + 3, TUBE.z - 2], M.pla, saddleLabel);
    const tie = mesh(new THREE.TorusGeometry(TUBE.r + 0.8, 0.9, 8, 40), M.rubber);
    tie.rotation.y = Math.PI / 2;
    tie.position.copy(W((x0 + x1) / 2, TUBE.y, TUBE.z));
    add("coil", tie, L("Zip tie", "", "Keeps the tube from rolling."));
  }
  live.barrel = ringX("coil", TUBE.x0, TUBE.x1, TUBE.y, TUBE.z, TUBE.bore, TUBE.r, M.acrylic, L("Barrel", "clear acrylic tube, 16 mm OD × 12 mm ID, 30 cm", "Smooth inside and not metal: a metal tube inside a coil is a shorted turn. Clear, so you can watch the slug. Breech toward the firer."), { segs: 64, shadow: false });
  live.barrel.renderOrder = 5;
  ringX("coil", TUBE.x0 + 2, TUBE.x0 + 9, TUBE.y, TUBE.z, TUBE.r, TUBE.r + 0.4, M.tapeBlue, L("Breech tape", "", "Marks the breech end."));
  const startTape = ringX("coil", BREECH + 19, BREECH + 21, TUBE.y, TUBE.z, TUBE.r, TUBE.r + 0.4, M.tapeYellow, L("Slug start mark", "", "Tape at the slug's tail so every shot starts the same: nose 1 to 2 cm inside the coil."));
  live.startTape = startTape;
  const cheekLabel = L("Cheek", "40 mm disc, 3D-printed PLA", "Stops the winding sliding off the tube. Glued on 40 mm apart, 4 cm from the breech.");
  ringX("coil", COIL.x0 - COIL.cheekT, COIL.x0, TUBE.y, TUBE.z, TUBE.r + 0.05, COIL.cheekR, M.pla, cheekLabel);
  ringX("coil", COIL.x1, COIL.x1 + COIL.cheekT, TUBE.y, TUBE.z, TUBE.r + 0.05, COIL.cheekR, M.pla, cheekLabel);
  const coilLabel = L("Coil", "about 96 turns of 1.6 mm magnet wire, 40 mm, 4 layers", "One continuous wire wound around the tube. The rings are turns, not separate coils. Current through it makes the field that pulls the slug.");
  live.coil = ringX("coil", COIL.x0, COIL.x1, TUBE.y, TUBE.z, TUBE.r + 0.05, COIL.rOut, M.enamel.clone(), coilLabel);
  for (let x = COIL.x0 + 0.85; x < COIL.x1 - 0.4; x += 1.65) {
    const t = mesh(new THREE.TorusGeometry(COIL.rOut + 0.02, 0.32, 6, 48), M.copper);
    t.rotation.y = Math.PI / 2;
    t.position.copy(W(x, TUBE.y, TUBE.z));
    add("coil", t, coilLabel, { shadow: false });
  }
  live.field = [];
  for (const [r, len, op] of [[COIL.rOut + 2.5, 42, 0.12], [COIL.rOut + 7, 50, 0.05]]) {
    const g = mesh(new THREE.CapsuleGeometry(r, len, 8, 32), new THREE.MeshBasicMaterial({ color: 0x5a7cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    g.rotation.z = Math.PI / 2;
    g.position.copy(W((COIL.x0 + COIL.x1) / 2, TUBE.y, TUBE.z));
    g.userData.peak = op;
    g.renderOrder = 6;
    groups.coil.add(g);
    live.field.push(g);
  }
  const ctbLabel = L("Coil terminal block", "2-way", "The coil's two tails land here, with the flyback diode across the same two terminals.");
  box("coil", [CTB.x0, CTB.y0, PZ], [CTB.x1, CTB.y1, CTB.top], M.blackPlastic, ctbLabel);
  for (const [x, y] of [CTB.A, CTB.B]) cylZ("coil", x, y, CTB.top, CTB.top + 1.6, 2.6, M.zinc, ctbLabel, { segs: 16 });
  const tailLabel = L("Coil tail", "50 cm, enamel scraped off the last 2 cm", "Bright copper at the screw: enamel is insulation, and an unscraped tail reads as an open circuit.");
  cable("coil", [[COIL.x0 + 1, TUBE.y, TUBE.z - COIL.rOut], [COIL.x0 + 1, TUBE.y + 6, PZ + 22], [CTB.A[0], CTB.A[1] - 1, CTB.top + 7], [CTB.A[0], CTB.A[1] - 1, CTB.top + 1.5]], 0.8, M.enamel, tailLabel, { bend: 5, hot: "loop" });
  cable("coil", [[COIL.x1 - 1, TUBE.y, TUBE.z - COIL.rOut], [COIL.x1 - 1, TUBE.y + 6, PZ + 22], [CTB.B[0], CTB.B[1] - 1, CTB.top + 7], [CTB.B[0], CTB.B[1] - 1, CTB.top + 1.5]], 0.8, M.enamel, tailLabel, { bend: 5, hot: "loop" });
  // the slug
  const slugLabel = L("Slug", "10 mm × 30 mm mild steel, about 18 g", "Ferromagnetic: a fridge magnet must grab it. Soft steel, not hardened or stainless. Nose 1 to 2 cm inside the coil before firing.");
  const slug = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(SLUG.r, SLUG.r, SLUG.len - 2, 32), M.steel);
  body.rotation.z = -Math.PI / 2;
  slug.add(body);
  for (const s of [-1, 1]) {
    const cap = mesh(new THREE.CylinderGeometry(s > 0 ? SLUG.r - 1 : SLUG.r, s > 0 ? SLUG.r : SLUG.r - 1, 1, 32), M.steel);
    cap.rotation.z = -Math.PI / 2;
    cap.position.x = s * (SLUG.len - 1) / 2;
    slug.add(cap);
  }
  add("coil", slug, slugLabel);
  live.slug = slug;
  live.arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x3ddc84, 6, 4);
  live.arrow.visible = false;
  groups.coil.add(live.arrow);
  live.tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0 }));
  groups.coil.add(live.tracer);
  // catch box and the plywood behind it, 30 cm from the muzzle
  const catchLabel = L("Catch box", "cardboard box stuffed with towels", "30 cm from the muzzle, open side to the barrel. Check the towels every ten shots.");
  box("coil", [CATCH.x0, CATCH.y0, 0], [CATCH.x1, CATCH.y1, 3], M.cardboard, catchLabel);
  box("coil", [CATCH.x1 - 3, CATCH.y0, 3], [CATCH.x1, CATCH.y1, CATCH.h], M.cardboard, catchLabel);
  box("coil", [CATCH.x0, CATCH.y0, 3], [CATCH.x1 - 3, CATCH.y0 + 3, CATCH.h], M.cardboard, catchLabel);
  box("coil", [CATCH.x0, CATCH.y1 - 3, 3], [CATCH.x1 - 3, CATCH.y1, CATCH.h], M.cardboard, catchLabel);
  box("coil", [CATCH.x0, CATCH.y0, CATCH.h - 3], [CATCH.x1, CATCH.y1, CATCH.h], M.cardboard, catchLabel);
  const towelLabel = L("Towels", "", "An 18 g slug at 8 m/s stops in a few centimetres of towel.");
  box("coil", [CATCH.x0 + 18, CATCH.y0 + 3, 3], [CATCH.x1 - 3, CATCH.y1 - 3, 52], M.towel3, towelLabel);
  box("coil", [CATCH.x0 + 26, CATCH.y0 + 3, 52], [CATCH.x1 - 3, CATCH.y1 - 3, 104], M.towel1, towelLabel);
  box("coil", [CATCH.x0 + 34, CATCH.y0 + 3, 104], [CATCH.x1 - 3, CATCH.y1 - 3, CATCH.h - 3], M.towel2, towelLabel);
  box("coil", [CATCH.x1 + 10, CATCH.y0 - 70, 0], [CATCH.x1 + 22, CATCH.y1 + 70, 340], M.plywood, L("Plywood backstop", "", "Behind the box, so a miss hits wood, not a wall or a window."));

  // ---------------------------------------------------------------- pulse wiring (10 AWG): + bus → switch → coil → − bus
  const loopLabel = L("Discharge loop", "10 AWG, four joints", "+ bus → push switch → coil → − bus. That is the whole pulse path. Keep each wire under 20 cm.");
  cable("wiring", [scr("L", 4), [TB.xL - 1, 60, TB.top + 1.5], [80, 69, PZ + 2.4], [-58, 69, PZ + 2.4], [-64, E_IN[1], PZ + 4], [E_IN[0] + 3, E_IN[1], E_IN[2]]], 2.2, M.cableRed, loopLabel, { bend: 7, hot: "loop" });
  cable("wiring", [[E_OUT[0] + 3, E_OUT[1], E_OUT[2]], [-62, E_OUT[1], PZ + 4], [-62, 12, PZ + 2.4], [CTB.A[0], 12, PZ + 2.4], [CTB.A[0], 2, PZ + 4], [CTB.A[0], CTB.A[1] + 3, CTB.top + 1.5]], 2.2, M.cableRed, loopLabel, { bend: 6, hot: "loop" });
  cable("wiring", [[CTB.B[0], CTB.B[1] + 3, CTB.top + 1.5], [CTB.B[0], 3, PZ + 4], [CTB.B[0] + 6, 5, PZ + 2.4], [TB.xL - 6, 5, PZ + 2.4], [TB.xL, 9, PZ + 6], scr("L", 1)], 2.2, M.cableBlack, loopLabel, { bend: 6, hot: "loop" });

  // ---------------------------------------------------------------- tools and safety
  // multimeter: probes clipped across the bank, display reads the bank
  const mmLabel = L("Multimeter", "DC volts, black on −, red on +", "The reading you trust before anyone touches anything. Under 5 V is safe to touch.");
  const MM = { x: 70, y: 150, w: 72, d: 130 };
  const mmGroup = new THREE.Group();
  mmGroup.position.copy(W(MM.x, MM.y, 0));
  mmGroup.rotation.x = -0.0;
  groups.tools.add(mmGroup);
  const mmBody = mesh(new THREE.BoxGeometry(MM.w, 26, MM.d), M.meterCase);
  mmBody.position.set(0, 13, 0);
  add("tools", mmBody, mmLabel, { parent: mmGroup });
  const mmFace = mesh(new THREE.BoxGeometry(MM.w - 10, 2, MM.d - 12), M.meterFace);
  mmFace.position.set(0, 26.5, 0);
  add("tools", mmFace, mmLabel, { parent: mmGroup });
  const mmDial = mesh(new THREE.CylinderGeometry(15, 15, 4, 32), M.blackPlastic);
  mmDial.position.set(0, 28, 18);
  add("tools", mmDial, L("Multimeter dial", "DC V", "Set to DC volts for the bank; resistance and continuity for the checks."), { parent: mmGroup });
  for (const [x, mat] of [[-18, M.blackPlastic], [18, M.red]]) { const j = mesh(new THREE.CylinderGeometry(3.5, 3.5, 4, 16), mat); j.position.set(x, 28, 52); add("tools", j, mmLabel, { parent: mmGroup }); }
  const mmDisplay = panel("tools", 52, 24, 384, L("Multimeter display", "bank voltage", "Read it out loud before and after the discharge stick."));
  mmDisplay.mesh.rotation.x = -Math.PI / 2;
  mmDisplay.mesh.position.set(0, 27.6, -28);
  groups.tools.remove(mmDisplay.mesh);
  mmGroup.add(mmDisplay.mesh);
  live.mmDisplay = mmDisplay;
  const probeLabel = L("Multimeter leads", "alligator clips", "Clipped across the bank: red on +, black on −.");
  cable("tools", [[MM.x + 18, MM.y - 52, 30], [MM.x + 18, MM.y - 70, 36], [80, 90, 44], [79.5, TB.ys[3], 40], [TB.xL - 2, TB.ys[3], TB.top + 3]], 1.0, M.cableRed, probeLabel, { bend: 10 });
  cable("tools", [[MM.x - 18, MM.y - 52, 30], [MM.x - 18, MM.y - 74, 40], [79.5, 70, 52], [79.5, TB.ys[0], 40], [TB.xL - 2, TB.ys[0], TB.top + 3]], 1.0, M.cableBlack, probeLabel, { bend: 10 });
  // discharge stick on its hook; in use it moves over the bank
  const DS = { hookX: 300, hookY: -210, hookZ: 300 };
  const dsLabel = L("Discharge stick", "100 Ω, 10 W on a ruler, two leads with alligator clips", "Empties the bank on purpose. Black clip on − first, red on + for five seconds, meter again. D clips it on and hangs it back up.");
  box("tools", [DS.hookX - 30, DS.hookY - 30, 0], [DS.hookX + 30, DS.hookY + 30, 8], M.benchWood, L("Hook stand", "", "The stick always hangs on the same hook."));
  box("tools", [DS.hookX - 6, DS.hookY - 6, 8], [DS.hookX + 6, DS.hookY + 6, DS.hookZ + 20], M.benchWood, L("Hook stand", "", "The stick always hangs on the same hook."));
  cylY("tools", DS.hookX, DS.hookY + 6, DS.hookY + 22, DS.hookZ, 1.6, M.zinc, null, { segs: 12 });
  const stick = new THREE.Group();
  const ruler = mesh(new THREE.BoxGeometry(25, 200, 4), M.plywood);
  ruler.position.set(0, -100, 0);
  const dsRes = mesh(new THREE.BoxGeometry(10, 48, 10), M.ceramic);
  dsRes.position.set(0, -170, 7);
  stick.add(ruler, dsRes);
  for (const y of [-152, -188]) { const tape = mesh(new THREE.BoxGeometry(27, 6, 13), M.tapeBlue); tape.position.set(0, y, 3); stick.add(tape); }
  const leadMat = (m) => m.clone();
  const hangLead = (x, mat) => {
    const c = routeCurve([new THREE.Vector3(x * 3, -195, 7), new THREE.Vector3(x * 10, -215, 9), new THREE.Vector3(x * 14, -260, 4), new THREE.Vector3(x * 10, -290, 2)], 10);
    const m = mesh(new THREE.TubeGeometry(c, 40, 1.0, 10, false), leadMat(mat));
    const clip = mesh(new THREE.BoxGeometry(5, 14, 4), mat === M.cableRed ? M.red : M.blackPlastic);
    clip.position.set(x * 10, -297, 2);
    stick.add(m, clip);
    return [m, clip];
  };
  const hang = [...hangLead(1, M.cableRed), ...hangLead(-1, M.cableBlack)];
  stick.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.label = dsLabel; o.userData.group = "tools"; pickables.push(o); } });
  stick.position.copy(W(DS.hookX, DS.hookY + 16, DS.hookZ - 2));
  groups.tools.add(stick);
  // in use: the clip end lies over the terminal block, the handle end held up and to the right
  const useRot = new THREE.Euler(0, 0, -Math.PI / 2 + 0.24);
  const tipTarget = W(TB.xL + 14, 33, TB.top + 70);
  const dir = new THREE.Vector3(0, -1, 0).applyEuler(useRot);
  const usePos = tipTarget.clone().sub(dir.clone().multiplyScalar(178));
  live.stick = { group: stick, hang, home: { pos: stick.position.clone(), rot: new THREE.Euler(0, 0, 0) }, use: { pos: usePos, rot: useRot } };
  stick.position.copy(usePos);
  stick.rotation.copy(useRot);
  stick.updateMatrixWorld(true);
  const resEnd = (y) => stick.localToWorld(new THREE.Vector3(0, y, 7));
  const rTop = resEnd(-148), rBot = resEnd(-192);
  stick.position.copy(live.stick.home.pos);
  stick.rotation.copy(live.stick.home.rot);
  const useLeads = [
    cable("tools", [rTop, rTop.clone().add(new THREE.Vector3(0, -6, 14)), W(TB.xL + 6, TB.ys[3] + 8, TB.top + 18), W(TB.xL - 1.5, TB.ys[3] + 1, TB.top + 3)], 1.0, M.cableRed, dsLabel, { bend: 8 }),
    cable("tools", [rBot, rBot.clone().add(new THREE.Vector3(0, -6, -14)), W(TB.xL + 6, TB.ys[0] - 8, TB.top + 18), W(TB.xL - 1.5, TB.ys[0] - 1, TB.top + 3)], 1.0, M.cableBlack, dsLabel, { bend: 8 }),
  ];
  for (const m of useLeads) { m.visible = false; live.cables.splice(live.cables.indexOf(m), 1); }
  live.stick.useLeads = useLeads;
  // safety glasses and the week 5 spare slugs
  const glLabel = L("Safety glasses", "one pair per person in the room", "A slug at 8 m/s, a spark from the switch and a venting capacitor all go for the eyes.");
  for (const s of [-1, 1]) { const lens = mesh(new THREE.CylinderGeometry(22, 22, 2, 32), M.glassLens); lens.position.copy(W(-260 + s * 26, 150, 3)); add("tools", lens, glLabel); }
  box("tools", [-306, 128, 1], [-214, 132, 6], M.blackPlastic, glLabel);
  for (const s of [-1, 1]) box("tools", [-260 + s * 46 - 2, 132, 1], [-260 + s * 46 + 2, 236, 4], M.blackPlastic, glLabel);
  const spareLabel = L("Spare slugs", "25 mm and 40 mm", "For week 5: try both lengths and note where each lands.");
  cylX("tools", -200, -175, 205, 5, 5, M.steel, spareLabel);
  cylX("tools", -160, -120, 205, 5, 5, M.steel, spareLabel);

  // ---------------------------------------------------------------- week 6+ upgrades (hidden until toggled)
  tagged(() => {
    // SCR on a bracket where the push switch was; its legs land on the same two wires
    const scrLabel = L("SCR (thyristor)", "400 V, 40 A or more, 500 A+ surge, TO-247", "Week 6 upgrade: replaces the push switch. A few milliamps into its gate snap it on; it switches off by itself at the end of the pulse.");
    box("switch", [-100, 36, PZ], [-80, 56, PZ + 3], M.alu, L("SCR bracket", "aluminium angle", "Mounting for the SCR. At 55 V one shot puts only 1 to 2 J into it, so no big heatsink is needed."));
    box("switch", [-100, 53, PZ + 3], [-80, 56, PZ + 32], M.alu, L("SCR bracket", "aluminium angle", "Mounting for the SCR."));
    live.scrBody = box("switch", [-97, 47, PZ + 8], [-83, 53, PZ + 28], M.diodeBody.clone(), scrLabel);
    live.emissive.scr = [live.scrBody];
    cable("switch", [[-86, 47, PZ + 9], [-80, 46, PZ + 9], [E_IN[0] + 3, E_IN[1], E_IN[2]]], 1.0, M.tinned, scrLabel, { bend: 2, lugs: [false, true] });
    cable("switch", [[-94, 47, PZ + 9], [-78, 40, PZ + 9], [E_OUT[0] + 3, E_OUT[1], E_OUT[2]]], 1.0, M.tinned, scrLabel, { bend: 2, lugs: [false, true] });
    // trigger board on nylon standoffs, 9 V battery on the bench
    const tbd = { x0: -148, x1: -113, y0: 8, y1: 68, z: PZ + 10 };
    const tbdLabel = L("Trigger board", "60 × 35 mm, two layers, 2 mm isolation slot", "Your KiCad board: button side on a 9 V battery, an optocoupler across the slot, gate side pushing about 50 mA into the SCR's gate.");
    for (const [x, y] of [[tbd.x0 + 4, tbd.y0 + 4], [tbd.x1 - 4, tbd.y0 + 4], [tbd.x0 + 4, tbd.y1 - 4], [tbd.x1 - 4, tbd.y1 - 4]]) cylZ("pcb", x, y, PZ, tbd.z, 2.2, M.nylon, L("Nylon standoff", "M3", ""), { segs: 12 });
    box("pcb", [tbd.x0, tbd.y0, tbd.z], [tbd.x1, tbd.y1, tbd.z + 1.6], M.pcb, tbdLabel);
    box("pcb", [tbd.x0 + 4, 37, tbd.z + 0.8], [tbd.x1 + 0.1, 39, tbd.z + 1.7], M.pcbBlue, L("Isolation slot", "2 mm", "Nothing copper crosses it; only the optocoupler's light does."));
    box("pcb", [-136, 34, tbd.z + 1.6], [-126, 42, tbd.z + 6], M.chip, L("U1 PC817 optocoupler", "", "LED on one side, light sensor on the other, no wire between."));
    live.trigBtn = cylZ("pcb", -142, 20, tbd.z + 1.6, tbd.z + 6, 3, M.blackPlastic.clone(), L("SW1 fire button", "", "Week 6 fire button: space fires when the upgrade is shown."), { segs: 16 });
    box("pcb", [-136, 52, tbd.z + 1.6], [-118, 56, tbd.z + 6], M.ceramic, L("R2", "1 kΩ, 2 W", "Feeds the gate from the bank's + side."));
    box("pcb", [-124, 44, tbd.z + 1.6], [-120, 48, tbd.z + 6], M.chip, L("Q1 2N2222", "", "Carries the 50 mA gate current."));
    box("pcb", [-118, 22, tbd.z + 1.6], [-113, 34, tbd.z + 8], M.green, L("J2 screw terminal", "A, G, K", "To the SCR, wires under 10 cm."));
    box("pcb", [-148, 12, tbd.z + 1.6], [-143, 22, tbd.z + 8], M.green, L("J1 screw terminal", "9 V in", "Battery clip plugs in here."));
    cable("pcb", [[-115, 28, tbd.z + 8], [-104, 34, PZ + 20], [-90, 47, PZ + 22]], 0.6, M.cableBlue, L("Gate lead", "", "J2 to the SCR's gate."), { bend: 4, hot: "gate" });
    box("pcb", [-250, 20, 0], [-224, 37, 48], M.battery, L("9 V battery", "", "Powers the button side only."));
    box("pcb", [-246, 22, 48], [-228, 35, 51], M.batteryTop, null);
    cable("pcb", [[-237, 28, 51], [-237, 28, 64], [-170, 18, 30], [-152, 17, PZ + 2], [-147, 17, tbd.z + 6]], 0.7, M.cableRed, L("Battery clip leads", "", ""), { bend: 10 });
    // two optical gates past the coil, used as a chronograph; microcontroller on the bench
    const gateLabel = (n) => L(`Optical gate ${n}`, "940 nm IR LED above, phototransistor below", "The slug breaks the beam and the signal pin flips. Two gates 50 mm apart and the microcontroller's clock give the slug's speed.");
    GATES.forEach((gx, i) => {
      ringX("sensing", gx - 3, gx + 3, TUBE.y, TUBE.z, TUBE.r + 0.05, TUBE.r + 6, M.blackPlastic, gateLabel(i + 1));
      box("sensing", [gx - 8, TUBE.y - 8, TUBE.z + TUBE.r + 6], [gx + 8, TUBE.y + 8, TUBE.z + TUBE.r + 7.6], M.pcb, L("Sensor board (LED side)", "15 × 15 mm", "D1 IR LED and R1 220 Ω."));
      box("sensing", [gx - 8, TUBE.y - 8, TUBE.z - TUBE.r - 7.6], [gx + 8, TUBE.y + 8, TUBE.z - TUBE.r - 6], M.pcb, L("Sensor board (eye side)", "15 × 15 mm", "Q1 phototransistor and R2 10 kΩ pull-down."));
      cable("sensing", [[gx, TUBE.y - 6, TUBE.z + TUBE.r + 7.6], [gx, TUBE.y - 6, TUBE.z + TUBE.r + 16], [gx - 20 + i * 4, -90, 40], [gx - 20 + i * 4, -100, 1.4], [-80 + i * 6, -112, 1.4]], 0.6, M.cableBlack, L("Gate leads", "5 V, GND, SIGNAL", "To the microcontroller. Keep them a few centimetres from the coil leads."), { bend: 10 });
    });
    box("sensing", [-110, -140, 0], [-60, -110, 8], M.nylon, L("Microcontroller standoffs", "", ""));
    box("sensing", [-108, -136, 8], [-63, -118, 9.6], M.pcbBlue, L("Microcontroller", "Arduino Nano", "Times the two gates: speed = 50 mm ÷ the time between the two beam breaks."));
    box("sensing", [-96, -132, 9.6], [-80, -122, 11], M.chip, L("Microcontroller", "Arduino Nano", "Times the two gates."));
  }, "later");

  // label anchors (block tags) and the slug's rest position
  const anchors = { charging: W(115, -220, 140), bank: W(90, 33, 90), switch: W(-92, 45, 50), coil: W(-90, -40, 70), sensing: W(25, -40, 70), pcb: W(-130, 38, 40), tools: W(70, 150, 50), bench: W(-120, 60, 20) };
  return { THREE, renderer, scene, camera, controls, groups, GROUP_INFO, anchors, pickables, live, materials: M, layout: { PZ, TUBE, COIL, SLUG, BREECH, CATCH, GATES, SCALE }, W, sun, hemi, fill };
}
