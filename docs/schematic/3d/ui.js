// The page: state machine, control panel, oscilloscope, labels, playback, camera, explode, theme.
// MODEL, THREE, OrbitControls and buildScene are in scope (inlined by build3d.mjs).

const root = document.documentElement;
const stage = document.querySelector(".cg3-stage");
const canvas = document.querySelector(".cg3-canvas");
const tooltip = document.querySelector(".cg3-tip");
const tagsHost = document.querySelector(".cg3-tags");
const panel = document.querySelector(".cg3-panel");
const scopeCanvas = document.querySelector(".cg3-scope");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const p = { ...MODEL.DEFAULTS };

const S = buildScene(THREE, OrbitControls, MODEL, canvas);
const { renderer, scene, camera, controls, groups, live, layout, W } = S;

// ---------------------------------------------------------------- theme
const THEMES = {
  dark: { bg: 0x101216, hemiSky: 0xdfe8ff, hemiGround: 0x2a2724, exposure: 1.05 },
  light: { bg: 0xeef0f3, hemiSky: 0xffffff, hemiGround: 0x8a8378, exposure: 1.15 },
};
function applyTheme(name) {
  root.dataset.theme = name;
  const t = THEMES[name];
  scene.background = new THREE.Color(t.bg);
  S.hemi.color.set(t.hemiSky);
  S.hemi.groundColor.set(t.hemiGround);
  renderer.toneMappingExposure = t.exposure;
  try { localStorage.setItem("cg3-theme", name); } catch {}
  draw();
}
let theme = "dark";
try { theme = localStorage.getItem("cg3-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); } catch {}

// ---------------------------------------------------------------- state
const SPEEDS = [{ label: "×50 slower", slow: 50 }, { label: "×200 slower", slow: 200 }, { label: "×1000 slower", slow: 1000 }, { label: "real time", slow: 1 }];
const BLEED_FAST = 17;
const state = {
  power: false,
  vBank: 0,
  phase: "off",
  shot: null,
  shotT: 0,
  paused: false,
  speed: 1,
  firedAt: -99,
  clock: 0,
  explode: 0,
  labelsAll: false,
  autoRotate: false,
  follow: false,
  stage2: false,
  env: { glow: 0, press: 0, key: 0, needle: 0, knob: 0 },
  hover: null,
  tour: true,
  tourStep: 0,
  tourAt: 0,
};
let derived = MODEL.derived(p);
let traceShot = MODEL.shot(p, p.vSet);
function recompute() {
  derived = MODEL.derived(p);
  traceShot = MODEL.shot(p, p.vSet);
  refreshReadouts();
  drawScope();
  rebuildLabels();
}

// ---------------------------------------------------------------- the machine
function setPower(flag) {
  if (state.power === flag) return;
  state.power = flag;
  if (flag) state.phase = state.vBank >= p.vSet - 0.5 ? "armed" : "charging";
  else if (state.phase !== "firing") state.phase = "bleeding";
  announce();
}
function fire() {
  if (state.phase !== "armed" || state.vBank < p.vMin) return false;
  state.shot = MODEL.shot(p, state.vBank);
  state.shotT = 0;
  state.phase = "firing";
  state.firedAt = state.clock;
  state.paused = false;
  live.slug.position.copy(live.slug.userData.home);
  tracerPoints.length = 0;
  announce();
  return true;
}
function resetAll() {
  state.power = false; state.vBank = 0; state.phase = "off"; state.shot = null; state.shotT = 0; state.paused = false;
  live.slug.position.copy(live.slug.userData.home);
  tracerPoints.length = 0;
  announce();
}
const tracerPoints = [];
function stepMachine(dt, calm) {
  switch (state.phase) {
    case "charging":
      state.vBank = MODEL.charge(state.vBank, p, dt);
      if (state.vBank >= p.vSet - 1e-6) { state.vBank = p.vSet; state.phase = "armed"; announce(); }
      break;
    case "armed":
      if (state.vBank < p.vSet - 0.5) state.phase = "charging";
      break;
    case "firing": {
      const s = state.shot;
      if (!state.paused) state.shotT = Math.min(s.end, state.shotT + dt / SPEEDS[state.speed].slow);
      const q = MODEL.sampleAt(s, state.shotT);
      state.vBank = q.vc;
      placeSlug(q);
      if (state.shotT >= s.end && !state.paused) {
        if (state.env.glow < 0.01) { state.phase = state.power ? "charging" : "bleeding"; state.shot = null; announce(); }
      }
      break;
    }
    case "bleeding":
      state.vBank = MODEL.bleed(state.vBank, p, dt * BLEED_FAST);
      if (state.vBank < 0.5) { state.vBank = 0; state.phase = "off"; announce(); }
      break;
  }
  const q = state.shot ? MODEL.sampleAt(state.shot, state.shotT) : null;
  const peakRef = MODEL.derived(p, p.vMax).peakI || 1;
  const fieldTarget = q ? Math.pow(q.i / peakRef, 2) : 0;
  const env = state.env;
  env.glow = calm ? fieldTarget : follow(env.glow, fieldTarget, dt, 0.05);
  env.needle = calm ? state.vBank : follow(env.needle, state.vBank, dt, 0.22);
  env.knob = calm ? p.vSet : follow(env.knob, p.vSet, dt, 0.15);
  const pressing = state.clock - state.firedAt > 0 && state.clock - state.firedAt < 0.35;
  env.press = calm ? (pressing ? 1 : 0) : follow(env.press, pressing ? 1 : 0, dt, 0.05);
  env.key = calm ? (state.power ? 1 : 0) : follow(env.key, state.power ? 1 : 0, dt, 0.12);
}
const follow = (x, target, dt, tau) => (Math.abs(target - x) < 1e-4 ? target : x + (target - x) * (1 - Math.exp(-dt / tau)));

function placeSlug(q) {
  const { BARREL, SCALE, SLUG, CATCH } = layout;
  const rear = (q.x - p.slugLen / 2) * SCALE; // from the breech face
  const centre = BARREL.x0 + rear + SLUG.len / 2;
  const stop = CATCH.x0 + 3 - SLUG.len / 2;
  const x = Math.min(stop, Math.max(BARREL.x0 + SLUG.len / 2, centre));
  live.slug.position.copy(W(x, BARREL.y, BARREL.z - (BARREL.bore - SLUG.r)));
  // force arrow: direction and size from the model's pull shape and current
  const g = MODEL.pull(q.x, p);
  const F = p.k * q.i * q.i * g;
  const show = Math.abs(F) > 0.5 && x < stop - 0.5;
  live.arrow.visible = show;
  if (show) {
    const len = Math.min(26, Math.abs(F) * 0.02);
    live.arrow.position.copy(live.slug.position).add(new THREE.Vector3(0, SLUG.r + 2.5, 0));
    live.arrow.setDirection(new THREE.Vector3(Math.sign(F), 0, 0));
    live.arrow.setLength(len, Math.min(4, len * 0.4), 2);
    live.arrow.setColor(F > 0 ? 0x3ddc84 : 0xff5a5a);
  }
  if (q.v > 1 && x < stop - 0.5) tracerPoints.push(live.slug.position.clone().add(new THREE.Vector3(-SLUG.len / 2, 0, 0)));
}

// ---------------------------------------------------------------- draw
let lastTheme = "";
function draw() {
  const env = state.env;
  const { METER, KNOB, BARREL, SLUG } = layout;
  // needle: -135° at 0 V, +135° at vMax
  live.needlePivot.rotation.y = -(-135 + 270 * Math.min(1, env.needle / p.vMax)) * (Math.PI / 180);
  const share = (env.knob - p.vMin) / (p.vMax - p.vMin);
  live.knobPivot.rotation.z = -(-135 + 270 * share) * (Math.PI / 180);
  live.button.position.y = live.button.userData.rest.y - 1.2 * env.press;
  live.keyPivot.rotation.y = Math.PI / 2 - (Math.PI / 2) * env.key;
  // lamps and conducting parts
  const firing = state.phase === "firing" && state.shot;
  const scrOn = firing && state.shotT < state.shot.diodeAt;
  const diodeOn = firing && state.shotT >= state.shot.diodeAt && state.shotT < state.shot.pulse;
  const loopOn = firing && state.shotT < state.shot.pulse;
  const age = state.clock - state.firedAt;
  glow(live.emissive.charge, state.phase === "charging" ? 1 : 0, 0xff6a3a);
  glow(live.emissive.mcu, state.power ? 1 : 0, 0x3ddc84);
  glow(live.emissive.gate, age > 0 && age < 0.6 ? 1 : 0, 0xff6a3a);
  glow(live.emissive.scr, scrOn ? 0.9 : 0, 0xff7a2a);
  glow(live.emissive.diode, diodeOn ? 0.9 : 0, 0xff7a2a);
  glow(live.emissive.loop, loopOn ? Math.min(1, env.glow * 3 + 0.25) : 0, 0xff4a2a);
  // bleeder warms while bleeding from a high voltage
  glow([live.bleeder], state.phase === "bleeding" ? Math.min(0.6, MODEL.bleedWatts(p, state.vBank) / 20) : 0, 0xff5a1a);
  const light = root.dataset.theme === "light";
  for (const shell of live.field) {
    shell.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    shell.material.color.set(light ? 0x3b5bdb : 0x5a7cff);
    shell.material.opacity = shell.userData.peak * Math.min(1, env.glow) * (light ? 0.55 : 1);
  }
  // tracer
  if (tracerPoints.length > 1) {
    live.tracer.geometry.setFromPoints(tracerPoints);
    live.tracer.material.opacity = firing ? 0.7 : Math.max(0, live.tracer.material.opacity - 0.01);
  } else live.tracer.material.opacity = 0;
  if (!firing) live.arrow.visible = false;
  // explode
  for (const g of Object.values(groups)) g.position.copy(g.userData.explode).multiplyScalar(state.explode);
  for (const c of live.cables) { c.material.transparent = state.explode > 0.01; c.material.opacity = 1 - 0.85 * state.explode; }
  // camera follow
  if (state.follow && firing) {
    const target = live.slug.getWorldPosition(new THREE.Vector3());
    controls.target.lerp(target, 0.2);
    const want = target.clone().add(new THREE.Vector3(-20, 22, 70));
    camera.position.lerp(want, 0.12);
  }
  controls.autoRotate = state.autoRotate && !still.matches && !state.follow;
  controls.update();
  renderer.render(scene, camera);
  placeTags();
  refreshLive();
}
function glow(meshes, level, color) {
  if (!meshes) return;
  for (const m of meshes) {
    const mat = m.material;
    if (!mat.emissive) continue;
    mat.emissive.set(color);
    mat.emissiveIntensity = level * 1.6;
  }
}

// ---------------------------------------------------------------- readouts and labels
const words = {
  off: () => `off · bank ${MODEL.fmt.v(state.vBank)}`,
  charging: () => `charging · ${MODEL.fmt.v(state.vBank)} · ${MODEL.fmt.j(MODEL.energy(p, state.vBank))}`,
  armed: () => `armed · ${MODEL.fmt.v(state.vBank)} · ${MODEL.fmt.j(MODEL.energy(p, state.vBank))}`,
  firing: () => { const q = MODEL.sampleAt(state.shot, state.shotT); return `${state.paused ? "paused" : "firing"} · t ${(state.shotT * 1e3).toFixed(2)} ms · ${MODEL.fmt.a(q.i)} · bank ${MODEL.fmt.v(q.vc)} · slug ${MODEL.fmt.mps(Math.max(0, q.v))}`; },
  bleeding: () => `bleeding · ${MODEL.fmt.v(state.vBank)} · 50 V in ${MODEL.fmt.s(MODEL.bleedTimeTo(p, state.vBank, p.vMin))}`,
};
const $ = (sel) => document.querySelector(sel);
let lastReadout = "";
function refreshLive() {
  const text = words[state.phase]();
  if (text !== lastReadout) { $("[data-readout]").textContent = text; lastReadout = text; }
  const scrub = $("#scrub");
  if (state.shot && document.activeElement !== scrub) scrub.value = String(Math.round((state.shotT / state.shot.end) * 1000));
  if (state.shot || scopeDirty) { drawScope(); }
}
function announce() {
  const live = $("[data-status]");
  live.textContent = state.phase;
  stage.setAttribute("aria-valuenow", String(p.vSet));
  stage.setAttribute("aria-valuetext", `${state.phase}: set ${MODEL.fmt.v(p.vSet)}, bank ${MODEL.fmt.v(state.vBank)}`);
  for (const b of document.querySelectorAll("[data-action='key']")) b.textContent = state.power ? "Key off" : "Key on";
}
function refreshReadouts() {
  const d = derived;
  const out = {
    C: `${(d.C * 1e6).toFixed(0)} µF`, E: MODEL.fmt.j(d.energy), charge: MODEL.fmt.s(d.chargeTime),
    peak: MODEL.fmt.a(d.peakI), half: MODEL.fmt.ms(d.halfPeriod), zero: MODEL.fmt.ms(d.scrTime ?? 0), pulse: MODEL.fmt.ms(d.pulse),
    bleed: MODEL.fmt.s(d.bleedTo50), tau: MODEL.fmt.s(d.bleedTau), watts: MODEL.fmt.w(d.bleedWatts),
    exit: MODEL.fmt.mps(d.exitV), kinetic: `${(0.5 * p.mass * d.exitV * d.exitV).toFixed(1)} J`, eff: MODEL.fmt.pct(d.efficiency),
  };
  for (const [k, v] of Object.entries(out)) { const el = $(`[data-out="${k}"]`); if (el) el.textContent = v; }
  const wattsEl = $('[data-out="watts"]');
  wattsEl.classList.toggle("warn", d.bleedWatts > p.bleedW);
  wattsEl.title = d.bleedWatts > p.bleedW ? `Over the ${p.bleedW} W rating at full charge` : "";
  // suck-back warning: where is the slug when the coil current has decayed to 5 %?
  const atEnd = MODEL.sampleAt(traceShot, traceShot.pulse);
  const inCoil = Math.abs(atEnd.x - p.coilAt) < (p.coilLen + p.slugLen) / 2;
  const warn = $("#suckback");
  warn.hidden = !(inCoil || d.exitV < 5);
  warn.textContent = d.exitV < 5 ? "The slug does not leave: the field is too weak for this mass." : `At the end of the pulse the slug is still in the coil (${(atEnd.x * 1e3).toFixed(0)} mm): the tail pulls it back. Shorter pulse, lighter slug or an IGBT cut-off.`;
}
function labelText(m) {
  const l = m.userData.label;
  const v = valueFor(l.name) ?? l.value;
  return { name: l.name, value: v, role: l.role };
}
function valueFor(name) {
  switch (name) {
    case "Electrolytic capacitor": return `${(p.capEach * 1e6).toFixed(0)} µF ${p.vMax} V × ${p.caps}`;
    case "Bleeder resistor": return `${(p.bleedR / 1e3).toFixed(p.bleedR >= 10e3 ? 0 : 1)} kΩ ${p.bleedW} W · 50 V in ${MODEL.fmt.s(derived.bleedTo50)}`;
    case "Drive coil": return `${(p.L * 1e6).toFixed(0)} µH, ${(p.coilLen * 1e3).toFixed(0)} mm · pulse ${MODEL.fmt.ms(derived.pulse)}`;
    case "Projectile": return `${(p.mass * 1e3).toFixed(0)} g, ${(p.slugLen * 1e3).toFixed(0)} mm · leaves at ${MODEL.fmt.mps(derived.exitV)}`;
    case "SCR (thyristor)": return `peak ${MODEL.fmt.a(derived.peakI)} · on for ${MODEL.fmt.ms(derived.scrTime ?? 0)}`;
    case "Flyback diode": return `carries the tail from ${MODEL.fmt.ms(derived.scrTime ?? 0)} to ${MODEL.fmt.ms(derived.pulse)}`;
    case "Boost charger": return `${p.chargeI} A limit · ${MODEL.fmt.v(p.vSet)} set · ${MODEL.fmt.s(derived.chargeTime)} to charge`;
    case "+ bus bar": case "− bus bar": return `${MODEL.fmt.j(derived.energy)} at ${MODEL.fmt.v(p.vSet)}`;
    case "Bank voltmeter": return `reads ${MODEL.fmt.v(state.vBank)}`;
    default: return null;
  }
}
function rebuildLabels() { if (state.hover) showTip(state.hover); }

// hover: raycast, highlight, tooltip
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2(-9, -9);
let hovered = null, hoverTime = 0;
function pick() {
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(S.pickables, false);
  const hit = hits.find((h) => h.object.visible && (!h.object.material.transparent || h.object.material.opacity > 0.2));
  const m = hit ? hit.object : null;
  if (m !== hovered) {
    if (hovered) setHighlight(hovered, false);
    hovered = m;
    state.hover = m;
    if (m) { setHighlight(m, true); showTip(m); }
    else hideTip();
  }
  if (hovered) positionTip(hovered);
}
const highlighted = new Map();
function setHighlight(m, on) {
  const same = S.pickables.filter((o) => o.userData.label && o.userData.label.name === m.userData.label.name && o.userData.group === m.userData.group);
  for (const o of same) {
    if (on) {
      if (!highlighted.has(o)) highlighted.set(o, o.material);
      const mat = highlighted.get(o).clone();
      if (mat.emissive) { mat.emissive.set(0x7fb2ff); mat.emissiveIntensity = 0.35; }
      o.material = mat;
    } else if (highlighted.has(o)) { o.material = highlighted.get(o); highlighted.delete(o); }
  }
}
function showTip(m) {
  const { name, value, role } = labelText(m);
  tooltip.innerHTML = `<b>${esc(name)}</b>${value ? `<span class="v">${esc(value)}</span>` : ""}${role ? `<span class="r">${esc(role)}</span>` : ""}`;
  tooltip.hidden = false;
  positionTip(m);
}
function hideTip() { tooltip.hidden = true; }
const tmp = new THREE.Vector3();
const bbox = new THREE.Box3();
function positionTip(m) {
  bbox.setFromObject(m);
  bbox.getCenter(tmp);
  tmp.y = bbox.max.y;
  tmp.project(camera);
  const r = canvas.getBoundingClientRect();
  const x = (tmp.x * 0.5 + 0.5) * r.width;
  const y = (-tmp.y * 0.5 + 0.5) * r.height;
  tooltip.style.left = `${Math.max(8, Math.min(r.width - 8, x))}px`;
  tooltip.style.top = `${Math.max(8, y - 10)}px`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// label-all tags: one per block at its anchor
const tags = Object.entries(S.anchors).map(([id, at]) => {
  const el = document.createElement("div");
  el.className = "cg3-tag";
  el.dataset.group = id;
  el.textContent = S.GROUP_INFO[id].title;
  el.hidden = true;
  tagsHost.appendChild(el);
  return { id, at, el };
});
function placeTags() {
  const r = canvas.getBoundingClientRect();
  for (const t of tags) {
    t.el.hidden = !state.labelsAll;
    if (!state.labelsAll) continue;
    tmp.copy(t.at).add(groups[t.id].position).project(camera);
    if (tmp.z > 1) { t.el.hidden = true; continue; }
    t.el.style.left = `${(tmp.x * 0.5 + 0.5) * r.width}px`;
    t.el.style.top = `${(-tmp.y * 0.5 + 0.5) * r.height}px`;
  }
}

// ---------------------------------------------------------------- oscilloscope
let scopeDirty = true;
function drawScope() {
  const c = scopeCanvas, g = c.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(root);
  const ink = css.getPropertyValue("--fg").trim() || "#ccc";
  const grid = css.getPropertyValue("--grid").trim() || "#444";
  g.clearRect(0, 0, w, h);
  const s = state.shot ?? traceShot;
  const T = s.end;
  const pad = { l: 6, r: 6, t: 8, b: 16 };
  const X = (t) => pad.l + (t / T) * (w - pad.l - pad.r);
  const Y = (f) => pad.t + (1 - f) * (h - pad.t - pad.b);
  g.strokeStyle = grid; g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i <= 4; i++) { const y = Y(i / 4); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); }
  for (let ms = 0; ms * 1e-3 <= T; ms += 1) { const x = X(ms * 1e-3); g.moveTo(x, pad.t); g.lineTo(x, h - pad.b); }
  g.stroke();
  const v0 = Math.max(1, s.vc[0]);
  const trace = (arr, norm, color, width = 1.6) => {
    g.strokeStyle = color; g.lineWidth = width; g.beginPath();
    for (let i = 0; i < s.t.length; i++) { const x = X(s.t[i]), y = Y(Math.max(0, Math.min(1, arr[i] / norm))); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  };
  trace(s.i, Math.max(1, s.peakI), "#ff7a2a");
  trace(s.vc, v0, "#4f8dff");
  trace(s.x, p.barrelLen, "#3ddc84");
  if (state.shot) {
    const x = X(state.shotT);
    g.strokeStyle = ink; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, h - pad.b); g.stroke(); g.setLineDash([]);
  }
  g.fillStyle = ink; g.font = "10px ui-monospace, monospace"; g.textBaseline = "alphabetic";
  g.fillText(`0`, pad.l, h - 4);
  g.textAlign = "right"; g.fillText(`${(T * 1e3).toFixed(1)} ms`, w - pad.r, h - 4);
  g.textAlign = "left";
  g.fillStyle = "#ff7a2a"; g.fillText(`i  ${MODEL.fmt.a(s.peakI)} pk`, pad.l + 4, pad.t + 10);
  g.fillStyle = "#4f8dff"; g.fillText(`V  ${MODEL.fmt.v(v0)}`, pad.l + 4, pad.t + 22);
  g.fillStyle = "#3ddc84"; g.fillText(`x  ${(p.barrelLen * 1e3).toFixed(0)} mm`, pad.l + 4, pad.t + 34);
  scopeDirty = false;
}

// ---------------------------------------------------------------- camera presets and explode
const PRESETS = {
  overview: { pos: W(10, 340, 190), target: W(20, 0, 8) },
  charger: { pos: W(-150, 60, 60), target: W(-123, -28, 14) },
  bank: { pos: W(-60, 70, 70), target: W(-48, -30, 16) },
  switch: { pos: W(40, 60, 50), target: W(20, -18, 8) },
  coil: { pos: W(70, 110, 60), target: W(100, 32, 24) },
  muzzle: { pos: W(230, 90, 60), target: W(140, 32, 26) },
  top: { pos: W(20, 40, 320), target: W(20, 0, 0) },
};
let camAnim = null;
function goTo(name) {
  const pr = PRESETS[name];
  if (!pr) return;
  state.follow = name === "follow";
  camAnim = { from: camera.position.clone(), to: pr.pos.clone(), tf: controls.target.clone(), tt: pr.target.clone(), start: performance.now() };
}
function stepCamera(dt) {
  if (!camAnim) return;
  const t = still.matches ? 1 : Math.min(1, (performance.now() - camAnim.start) / 900);
  camAnim.t = t;
  const e = t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(camAnim.from, camAnim.to, e);
  controls.target.lerpVectors(camAnim.tf, camAnim.tt, e);
  if (camAnim.t >= 1) camAnim = null;
}

// ---------------------------------------------------------------- the panel
const CONTROLS = [
  { section: "Circuit", items: [
    { id: "vSet", label: "Bank voltage", min: 50, max: 450, step: 10, unit: "V", get: () => p.vSet, set: (v) => { p.vSet = v; if (state.power && state.phase !== "firing") state.phase = state.vBank >= p.vSet - 0.5 ? "armed" : "charging"; } },
    { id: "caps", label: "Capacitors in parallel", min: 1, max: 8, step: 1, unit: "", get: () => p.caps, set: (v) => (p.caps = v) },
    { id: "capEach", label: "Capacitance each", min: 100, max: 4700, step: 10, unit: "µF", get: () => p.capEach * 1e6, set: (v) => (p.capEach = v * 1e-6) },
    { id: "L", label: "Coil inductance", min: 20, max: 500, step: 5, unit: "µH", get: () => p.L * 1e6, set: (v) => (p.L = v * 1e-6) },
    { id: "R", label: "Loop resistance", min: 10, max: 500, step: 5, unit: "mΩ", get: () => p.R * 1e3, set: (v) => (p.R = v * 1e-3) },
    { id: "chargeI", label: "Charger current limit", min: 0.2, max: 5, step: 0.1, unit: "A", get: () => p.chargeI, set: (v) => (p.chargeI = v) },
    { id: "bleedR", label: "Bleeder resistance", min: 1, max: 100, step: 1, unit: "kΩ", get: () => p.bleedR / 1e3, set: (v) => (p.bleedR = v * 1e3) },
  ], outs: [["C", "Bank C"], ["E", "Stored energy"], ["charge", "Charge time"], ["peak", "Peak current"], ["half", "π√LC"], ["zero", "Bank at 0 V"], ["pulse", "Pulse to 5 %"], ["tau", "Bleed τ"], ["bleed", "Bleed to 50 V"], ["watts", "Bleeder at full charge"]] },
  { section: "Projectile and coil", items: [
    { id: "mass", label: "Slug mass", min: 2, max: 30, step: 0.5, unit: "g", get: () => p.mass * 1e3, set: (v) => (p.mass = v * 1e-3) },
    { id: "slugLen", label: "Slug length", min: 10, max: 60, step: 1, unit: "mm", get: () => p.slugLen * 1e3, set: (v) => (p.slugLen = v * 1e-3) },
    { id: "coilLen", label: "Coil length", min: 20, max: 120, step: 2, unit: "mm", get: () => p.coilLen * 1e3, set: (v) => (p.coilLen = v * 1e-3) },
    { id: "coilAt", label: "Coil centre from breech", min: 40, max: 200, step: 5, unit: "mm", get: () => p.coilAt * 1e3, set: (v) => (p.coilAt = v * 1e-3) },
    { id: "k", label: "Force constant k", min: 0.00002, max: 0.0006, step: 0.00001, unit: "N/A²", get: () => p.k, set: (v) => (p.k = v), fmt: (v) => v.toExponential(1) },
  ], outs: [["exit", "Exit velocity"], ["kinetic", "Kinetic energy"], ["eff", "Efficiency"]], note: "suckback" },
];
function buildPanel() {
  const frag = document.createDocumentFragment();
  for (const sec of CONTROLS) {
    const d = document.createElement("details");
    d.open = true;
    d.innerHTML = `<summary>${sec.section}</summary>`;
    const body = document.createElement("div");
    body.className = "cg3-sec";
    for (const it of sec.items) {
      const row = document.createElement("label");
      row.className = "cg3-row";
      row.innerHTML = `<span class="n">${it.label}</span><input id="ctl-${it.id}" type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${it.get()}"><output for="ctl-${it.id}">${(it.fmt ? it.fmt(it.get()) : it.get())} ${it.unit}</output>`;
      const input = row.querySelector("input");
      const out = row.querySelector("output");
      input.addEventListener("input", () => {
        const v = Number(input.value);
        it.set(v);
        out.textContent = `${it.fmt ? it.fmt(v) : v} ${it.unit}`;
        recompute();
        if (it.id === "vSet") announce();
        takeOver();
      });
      body.appendChild(row);
    }
    if (sec.outs) {
      const grid = document.createElement("div");
      grid.className = "cg3-outs";
      grid.innerHTML = sec.outs.map(([k, l]) => `<span class="k">${l}</span><span class="o" data-out="${k}">–</span>`).join("");
      body.appendChild(grid);
    }
    if (sec.note === "suckback") { const w = document.createElement("p"); w.id = "suckback"; w.className = "cg3-warn"; w.hidden = true; body.appendChild(w); }
    d.appendChild(body);
    frag.appendChild(d);
  }
  panel.querySelector("[data-controls]").appendChild(frag);
  // playback
  $("#speed").innerHTML = SPEEDS.map((s, i) => `<option value="${i}"${i === state.speed ? " selected" : ""}>${s.label}</option>`).join("");
  $("#speed").addEventListener("change", (e) => { state.speed = Number(e.target.value); });
  $("#scrub").addEventListener("input", (e) => {
    if (!state.shot) { if (state.phase !== "armed") return; fire(); }
    state.paused = true;
    state.shotT = (Number(e.target.value) / 1000) * state.shot.end;
    takeOver();
  });
  for (const b of document.querySelectorAll("[data-action]")) b.addEventListener("click", () => { act(b.dataset.action); takeOver(); });
  $("#explode").addEventListener("input", (e) => { state.explode = Number(e.target.value) / 100; takeOver(); });
  $("#autorotate").addEventListener("change", (e) => { state.autoRotate = e.target.checked; });
  $("#labels").addEventListener("change", (e) => { state.labelsAll = e.target.checked; });
  $("#shadows").addEventListener("change", (e) => { renderer.shadowMap.enabled = e.target.checked; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); });
  $("#theme").addEventListener("change", (e) => applyTheme(e.target.checked ? "light" : "dark"));
  for (const b of document.querySelectorAll("[data-view]")) b.addEventListener("click", () => { goTo(b.dataset.view); takeOver(); });
  $("#follow").addEventListener("change", (e) => { state.follow = e.target.checked; if (!state.follow) goTo("coil"); });
  $("#toggle-panel").addEventListener("click", () => { panel.classList.toggle("collapsed"); onResize(); });
}
function act(name) {
  switch (name) {
    case "key": setPower(!state.power); break;
    case "fire": if (!state.power) setPower(true); else fire(); break;
    case "pause": if (state.shot) state.paused = !state.paused; break;
    case "reset": resetAll(); break;
    case "resetview": goTo("overview"); break;
  }
}

// ---------------------------------------------------------------- tour
const TOUR_V = [400, 250, 450];
let round = 0;
function tourTick(dt) {
  state.tourAt += dt;
  if (state.tourStep === 0 && state.tourAt > 0.8) { p.vSet = TOUR_V[round % TOUR_V.length]; $("#ctl-vSet").value = p.vSet; $("#ctl-vSet").nextElementSibling.textContent = `${p.vSet} V`; recompute(); setPower(true); state.tourStep = 1; state.tourAt = 0; }
  else if (state.tourStep === 1 && state.phase === "armed" && state.tourAt > 1.4) { fire(); state.tourStep = 2; state.tourAt = 0; }
  else if (state.tourStep === 2 && state.phase !== "firing" && state.tourAt > 1.5) { setPower(false); state.tourStep = 3; state.tourAt = 0; }
  else if (state.tourStep === 3 && state.phase === "off" && state.tourAt > 1.2) { state.tourStep = 0; state.tourAt = 0; round++; }
}
let idleTimer = 0;
function takeOver() {
  state.tour = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { state.tour = true; state.tourStep = state.power ? 1 : 0; state.tourAt = 0; } }, 20000);
}

// ---------------------------------------------------------------- loop, input, resize
let last = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  state.clock += dt;
  if (state.tour && !still.matches) tourTick(dt);
  stepMachine(dt, still.matches);
  stepCamera(dt);
  pick();
  draw();
  requestAnimationFrame(tick);
}
function onResize() {
  const r = stage.getBoundingClientRect();
  const w = Math.max(200, r.width), h = Math.max(200, r.height);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  scopeDirty = true;
}
addEventListener("resize", onResize);
new ResizeObserver(onResize).observe(stage);
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  if (drag) { p.vSet = Math.round(Math.min(p.vMax, Math.max(p.vMin, drag.v0 - (e.clientY - drag.y0) * 2.5)) / 10) * 10; $("#ctl-vSet").value = p.vSet; $("#ctl-vSet").nextElementSibling.textContent = `${p.vSet} V`; recompute(); announce(); }
});
canvas.addEventListener("pointerleave", () => { pointer.set(-9, -9); });
let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  if (hovered && hovered.userData.label.name === "Voltage set knob") {
    drag = { y0: e.clientY, v0: p.vSet };
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    takeOver();
  }
});
const endDrag = () => { if (drag) { drag = null; controls.enabled = true; } };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener("click", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4 || !hovered) return;
  const name = hovered.userData.label.name;
  if (name === "Fire button") { act("fire"); takeOver(); }
  else if (name === "Key" || name === "Key switch") { act("key"); takeOver(); }
});
stage.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 50 : 10;
  const setV = (v) => { p.vSet = Math.min(p.vMax, Math.max(p.vMin, v)); $("#ctl-vSet").value = p.vSet; $("#ctl-vSet").nextElementSibling.textContent = `${p.vSet} V`; recompute(); announce(); };
  let handled = true;
  switch (e.key) {
    case "ArrowUp": case "ArrowRight": setV(p.vSet + step); break;
    case "ArrowDown": case "ArrowLeft": setV(p.vSet - step); break;
    case "Home": setV(p.vMin); break;
    case "End": setV(p.vMax); break;
    case " ": case "Enter": act("fire"); break;
    case "k": case "K": act("key"); break;
    case "p": case "P": act("pause"); break;
    case "l": case "L": state.labelsAll = !state.labelsAll; $("#labels").checked = state.labelsAll; break;
    case "r": case "R": goTo("overview"); break;
    case "Escape": setPower(false); break;
    default: handled = false;
  }
  if (!handled) return;
  e.preventDefault();
  takeOver();
});

buildPanel();
window.__cg3 = { camera, controls, state, live, p, goTo, PRESETS };
applyTheme(theme);
$("#theme").checked = theme === "light";
recompute();
announce();
onResize();
if (still.matches) { state.tour = false; state.autoRotate = false; p.vSet = 400; state.vBank = 400; state.power = true; state.phase = "armed"; state.env.needle = 400; state.env.knob = 400; state.env.key = 1; announce(); }
requestAnimationFrame(tick);
