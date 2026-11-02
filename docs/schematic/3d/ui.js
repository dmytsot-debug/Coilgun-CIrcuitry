// The page: the guide's firing sequence, control panel, oscilloscope, labels, playback, camera, explode, theme.
// MODEL, THREE, OrbitControls and buildScene are in scope (inlined by build3d.mjs).

const root = document.documentElement;
const stage = document.querySelector(".cg3-stage");
const canvas = document.querySelector(".cg3-canvas");
const tooltip = document.querySelector(".cg3-tip");
const tagsHost = document.querySelector(".cg3-tags");
const panelEl = document.querySelector(".cg3-panel");
const scopeCanvas = document.querySelector(".cg3-scope");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (sel) => document.querySelector(sel);

// ---------------------------------------------------------------- the guide's build, as model parameters
const GUIDE = {
  vSet: 55, vMin: 5, vMax: 55, // supply taped at 55 V; capacitors rated 63 V; under 5 V is safe to touch
  caps: 2, capEach: 10000e-6, chargeI: 1, // two 10 000 µF cans, 1 A current limit
  L: 75e-6, R: 0.06, // the 40 mm, 96-turn coil and the 10 AWG loop
  bleedR: 1000, bleedW: 10, // 1 kΩ 10 W bleeder
  mass: 0.018, slugLen: 0.03, coilLen: 0.04, coilAt: 0.06, barrelLen: 0.3, // 10 × 30 mm slug, coil 4 cm from the breech, 30 cm tube
  k: 0.0003, noseIn: 0.01, // force constant (assumed), slug nose 1 cm inside the coil
};
const DIODE_DROP = 0.8; // the blocking diode costs about a volt
const STICK_R = 100; // discharge stick: 100 Ω
const SAFE_V = 5;
const p = { ...MODEL.DEFAULTS, ...GUIDE };
const slugStartOf = (q) => q.coilAt - q.coilLen / 2 + q.noseIn - q.slugLen;
const vFull = () => Math.max(0, p.vSet - DIODE_DROP);
const params = () => ({ ...p, vSet: vFull(), slugStart: slugStartOf(p) });

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
}
let theme = "dark";
try { theme = localStorage.getItem("cg3-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); } catch {}

// ---------------------------------------------------------------- state
const SPEEDS = [{ label: "×50 slower", slow: 50 }, { label: "×200 slower", slow: 200 }, { label: "×1000 slower", slow: 1000 }, { label: "real time", slow: 1 }];
const FLIGHT_SLOW = 20; // after the pulse the slug's flight plays 20× slower
const state = {
  supplyOn: false,
  knifeClosed: false,
  stickOn: false,
  upgrades: false,
  vBank: 0,
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
  env: { glow: 0, press: 0, knife: 0, stick: 0 },
  hover: null,
  tour: true,
  tourStep: 0,
  tourAt: 0,
  warn: "",
  warnUntil: 0,
  landed: null,
};
const connected = () => state.supplyOn && state.knifeClosed;
let derived, traceShot, chrono;
function recompute() {
  const q = params();
  derived = MODEL.derived(q);
  derived.bleedTo5 = MODEL.bleedTimeTo(q, q.vSet, SAFE_V);
  derived.stickTo5 = Math.log(Math.max(1, q.vSet / SAFE_V)) * ((q.bleedR * STICK_R) / (q.bleedR + STICK_R)) * MODEL.capacitance(q);
  traceShot = MODEL.shot(q, q.vSet);
  chrono = chronoOf(traceShot);
  refreshReadouts();
  drawScope();
  if (state.hover) showTip(state.hover);
}
function warn(text) { state.warn = text; state.warnUntil = state.clock + 4.5; }

// ---------------------------------------------------------------- the machine (the guide's sequence)
function setSupply(on) {
  state.supplyOn = on;
  if (on && state.knifeClosed && state.stickOn) { state.knifeClosed = false; warn("opened the disconnect: never charge with the discharge stick on"); }
  announce();
}
function setKnife(closed) {
  if (closed && state.stickOn) { warn("hang up the discharge stick before closing the disconnect"); return; }
  state.knifeClosed = closed;
  announce();
}
function setStick(on) {
  if (on && connected()) { warn("open the disconnect first (K): the supply is still on the bank"); return; }
  if (state.shot) return;
  state.stickOn = on;
  announce();
}
function fire() {
  if (state.shot) return false;
  if (state.stickOn) { warn("the discharge stick is on the bank: nothing to fire"); return false; }
  if (state.vBank < 1) { warn("the bank is empty: charge it first (supply on, close the disconnect)"); return false; }
  if (connected()) warn("the disconnect was closed: open it before firing (tab 1). The blocking diode took the kick.");
  const q = { ...params(), vSet: state.vBank };
  state.shot = MODEL.shot(q, state.vBank);
  state.shot.chrono = chronoOf(state.shot);
  state.shotT = 0;
  state.paused = false;
  state.firedAt = state.clock;
  state.landed = null;
  tracerPoints.length = 0;
  announce();
  return true;
}
function resetAll() {
  Object.assign(state, { supplyOn: false, knifeClosed: false, stickOn: false, vBank: 0, shot: null, shotT: 0, paused: false, landed: null, warn: "" });
  tracerPoints.length = 0;
  placeSlugAt(slugStartOf(p) + p.slugLen / 2, 0);
  announce();
}
// position of the slug's centre (model metres from the breech face) and its speed at model time t,
// carrying on ballistically after the integration ends
function slugAt(s, t) {
  if (t <= s.end) { const q = MODEL.sampleAt(s, t); return { x: q.x, v: q.v, i: q.i, vc: q.vc }; }
  const n = s.t.length - 1;
  const v = s.v[n];
  return { x: s.x[n] + (v > 0 ? v * (t - s.end) : 0), v: v > 0 ? v : 0, i: 0, vc: 0 };
}
// times at which the slug's nose crosses each optical gate, and the speed they give
function chronoOf(s) {
  const noseAt = (gx) => (gx - layout.BREECH) / layout.SCALE;
  const times = layout.GATES.map((gx) => {
    const target = noseAt(gx) - p.slugLen / 2;
    for (let i = 1; i < s.t.length; i++) if (s.x[i] >= target) { const f = (target - s.x[i - 1]) / (s.x[i] - s.x[i - 1] || 1); return s.t[i - 1] + f * (s.t[i] - s.t[i - 1]); }
    const n = s.t.length - 1;
    return s.v[n] > 0 ? s.end + (target - s.x[n]) / s.v[n] : null;
  });
  const [t1, t2] = times;
  return { t1, t2, v: t1 !== null && t2 !== null && t2 > t1 ? ((layout.GATES[1] - layout.GATES[0]) / layout.SCALE) / (t2 - t1) : null };
}
const tracerPoints = [];
function stepMachine(dt, calm) {
  const C = MODEL.capacitance(p);
  if (state.shot) {
    const s = state.shot;
    if (!state.paused) state.shotT += dt / (state.shotT < s.pulse ? SPEEDS[state.speed].slow : Math.min(SPEEDS[state.speed].slow, FLIGHT_SLOW));
    const q = slugAt(s, state.shotT);
    state.vBank = q.vc;
    const stopped = placeSlugAt(q.x, q.v, q.i);
    if (!state.paused && state.shotT > s.end && (stopped || q.v <= 0)) {
      state.landed = { v: s.chrono.v ?? s.v.at(-1), at: state.clock, inBox: stopped };
      state.shot = null;
      state.vBank = 0;
      announce();
    }
  } else if (connected()) {
    const net = p.chargeI - state.vBank / p.bleedR;
    if (state.vBank < vFull() && net > 0) state.vBank = Math.min(vFull(), state.vBank + (net / C) * dt);
  } else {
    const R = state.stickOn ? (p.bleedR * STICK_R) / (p.bleedR + STICK_R) : p.bleedR;
    state.vBank *= Math.exp(-dt / (R * C));
    if (state.vBank < 0.005) state.vBank = 0;
  }
  const q = state.shot ? slugAt(state.shot, state.shotT) : null;
  const peakRef = MODEL.derived({ ...params(), vSet: p.vMax }).peakI || 1;
  const env = state.env;
  const ease = (x, target, tau) => (calm || Math.abs(target - x) < 1e-4 ? target : x + (target - x) * (1 - Math.exp(-dt / tau)));
  env.glow = ease(env.glow, q ? Math.pow(q.i / peakRef, 2) : 0, 0.05);
  const pressing = state.clock - state.firedAt > 0 && state.clock - state.firedAt < 0.35;
  env.press = ease(env.press, pressing ? 1 : 0, 0.05);
  env.knife = ease(env.knife, state.knifeClosed ? 0 : 1, 0.12);
  env.stick = ease(env.stick, state.stickOn ? 1 : 0, 0.3);
}
// place the slug from its model centre position; returns true once it rests in the catch box
function placeSlugAt(xModel, v = 0, i = 0) {
  const { TUBE, SLUG, BREECH, CATCH, SCALE } = layout;
  let cx = BREECH + xModel * SCALE;
  const stop = CATCH.x0 + 24; // nose a few millimetres into the towels
  const inBox = cx >= stop;
  cx = Math.min(stop, Math.max(BREECH + SLUG.len / 2, cx));
  const past = cx + SLUG.len / 2 - TUBE.x1; // nose past the muzzle, mm
  const drop = past > 0 && v > 0.5 ? Math.min(SLUG.z - 4, 0.5 * 9.81 * Math.pow(past / 1000 / v, 2) * 1000) : 0;
  live.slug.position.copy(W(cx, TUBE.y, SLUG.z - drop));
  const g = MODEL.pull(xModel, p);
  const F = p.k * i * i * g;
  const show = Math.abs(F) > 0.05 && cx < TUBE.x1;
  live.arrow.visible = show;
  if (show) {
    const len = Math.min(40, Math.abs(F) * 1.2);
    live.arrow.position.copy(live.slug.position).add(new THREE.Vector3(0, TUBE.r + 9, 0));
    live.arrow.setDirection(new THREE.Vector3(Math.sign(F), 0, 0));
    live.arrow.setLength(Math.max(8, len), 6, 4);
    live.arrow.setColor(F > 0 ? 0x3ddc84 : 0xff5a5a);
  }
  if (v > 0.5 && !inBox) tracerPoints.push(live.slug.position.clone().add(new THREE.Vector3(-SLUG.len / 2, 0, 0)));
  return inBox;
}

// ---------------------------------------------------------------- displays (canvas textures)
function drawSupplyDisplay() {
  const d = live.supplyDisplay;
  const charging = connected() && state.vBank < vFull() - 0.05 && !state.shot;
  const volts = state.supplyOn ? (connected() ? Math.min(p.vSet, state.vBank + DIODE_DROP) : p.vSet) : p.vSet;
  const amps = state.supplyOn && connected() && !state.shot ? (charging ? p.chargeI : state.vBank / p.bleedR) : 0;
  const mode = !state.supplyOn ? "OFF" : charging ? "CC" : "CV";
  const text = `${volts.toFixed(1)}|${amps.toFixed(3)}|${mode}`;
  if (text === d.last) return;
  d.last = text;
  const g = d.ctx, w = d.cv.width, h = d.cv.height;
  g.fillStyle = "#07090b"; g.fillRect(0, 0, w, h);
  const big = `bold ${Math.round(h * 0.34)}px ui-monospace, Menlo, Consolas, monospace`;
  const small = `${Math.round(h * 0.14)}px ui-monospace, Menlo, Consolas, monospace`;
  g.textBaseline = "alphabetic";
  g.font = big; g.textAlign = "right";
  g.fillStyle = state.supplyOn ? "#ff3b30" : "#5a1c18"; g.fillText(volts.toFixed(1), w * 0.62, h * 0.4);
  g.fillStyle = state.supplyOn ? "#30d158" : "#173f22"; g.fillText(amps.toFixed(3), w * 0.62, h * 0.82);
  g.font = small; g.textAlign = "left"; g.fillStyle = "#9aa3ad";
  g.fillText("V", w * 0.64, h * 0.4); g.fillText("A", w * 0.64, h * 0.82);
  g.fillStyle = mode === "OFF" ? "#9aa3ad" : mode === "CC" ? "#ffb340" : "#30d158";
  g.fillText(mode === "OFF" ? "OUT OFF" : mode, w * 0.76, h * 0.6);
  d.tex.needsUpdate = true;
}
function drawMeterDisplay() {
  const d = live.mmDisplay;
  const v = state.vBank;
  const text = v >= 99.995 ? "OL" : v.toFixed(2);
  if (text === d.last) return;
  d.last = text;
  const g = d.ctx, w = d.cv.width, h = d.cv.height;
  g.fillStyle = "#9aa58c"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#1a1d17";
  g.font = `bold ${Math.round(h * 0.6)}px ui-monospace, Menlo, Consolas, monospace`;
  g.textAlign = "right"; g.textBaseline = "alphabetic";
  g.fillText(text, w * 0.84, h * 0.72);
  g.font = `${Math.round(h * 0.2)}px ui-monospace, Menlo, Consolas, monospace`;
  g.textAlign = "left";
  g.fillText("V", w * 0.86, h * 0.72);
  g.fillText("DC", w * 0.05, h * 0.26);
  if (v < SAFE_V) { g.fillText("safe", w * 0.05, h * 0.9); }
  d.tex.needsUpdate = true;
}

// ---------------------------------------------------------------- draw
const isShown = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
function applyUpgrades() {
  for (const o of live.later) o.visible = state.upgrades;
  for (const o of live.early) o.visible = !state.upgrades;
  const fireBtn = document.querySelector("[data-action='fire']");
  if (fireBtn) fireBtn.textContent = state.upgrades ? "Fire (trigger board)" : "Fire (push switch)";
  refreshReadouts();
}
const tmpQ = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function draw() {
  const env = state.env;
  live.knifePivot.rotation.z = -1.2 * env.knife;
  const btn = state.upgrades ? live.trigBtn : live.fireBtn;
  if (live.fireBtn) live.fireBtn.position.y = live.fireBtn.userData.rest.y - 2.5 * (state.upgrades ? 0 : env.press);
  if (live.trigBtn) live.trigBtn.scale.y = 1 - 0.4 * (state.upgrades ? env.press : 0);
  // discharge stick: hook → over the bank
  const st = live.stick;
  st.group.position.lerpVectors(st.home.pos, st.use.pos, env.stick);
  qa.setFromEuler(st.home.rot); qb.setFromEuler(st.use.rot);
  st.group.quaternion.copy(tmpQ.slerpQuaternions(qa, qb, env.stick));
  const clipped = env.stick > 0.97;
  for (const m of st.hang) m.visible = !clipped;
  for (const m of st.useLeads) m.visible = clipped;
  // lamps and conducting parts
  const s = state.shot;
  const firing = !!s;
  const conducting = firing && state.shotT < (s.diodeAt ?? 0);
  const freewheel = firing && state.shotT >= (s.diodeAt ?? 0) && state.shotT < s.pulse;
  glow([live.outBtn], state.supplyOn ? 0.9 : 0, 0x30d158);
  glow(live.emissive.scr, state.upgrades && conducting ? 0.9 : 0, 0xff7a2a);
  glow(live.emissive.diode, freewheel ? 0.9 : 0, 0xff7a2a);
  glow(live.emissive.loop, firing && state.shotT < s.pulse ? Math.min(1, env.glow * 3 + 0.25) : 0, 0xff4a2a);
  glow(live.emissive.gate, state.upgrades && state.clock - state.firedAt > 0 && state.clock - state.firedAt < 0.5 ? 0.9 : 0, 0x6ea0ff);
  glow([live.bleeder], !connected() && !firing ? Math.min(0.5, MODEL.bleedWatts(p, state.vBank) / 8) : 0, 0xff5a1a);
  const light = root.dataset.theme === "light";
  for (const shell of live.field) {
    shell.material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    shell.material.color.set(light ? 0x3b5bdb : 0x5a7cff);
    shell.material.opacity = shell.userData.peak * Math.min(1, env.glow) * (light ? 0.45 : 1);
  }
  if (tracerPoints.length > 1) {
    live.tracer.geometry.setFromPoints(tracerPoints);
    live.tracer.material.opacity = firing ? 0.7 : Math.max(0, live.tracer.material.opacity - 0.01);
  } else live.tracer.material.opacity = 0;
  if (!firing) live.arrow.visible = false;
  drawSupplyDisplay();
  drawMeterDisplay();
  // explode
  for (const g of Object.values(groups)) g.position.copy(g.userData.explode).multiplyScalar(state.explode);
  for (const c of live.cables) { c.material.transparent = state.explode > 0.01; c.material.opacity = 1 - 0.85 * state.explode; }
  if (state.follow && firing) {
    const target = live.slug.getWorldPosition(new THREE.Vector3());
    controls.target.lerp(target, 0.2);
    camera.position.lerp(target.clone().add(new THREE.Vector3(-40, 50, 150)), 0.12);
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
    if (!mat || !mat.emissive) continue;
    mat.emissive.set(color);
    mat.emissiveIntensity = level * 1.6;
  }
}

// ---------------------------------------------------------------- readouts and labels
function phaseText() {
  const V = MODEL.fmt.v(state.vBank), E = MODEL.fmt.j(MODEL.energy(p, state.vBank));
  if (state.shot) {
    const s = state.shot, q = slugAt(s, state.shotT);
    const tag = state.paused ? "paused" : state.shotT < s.pulse ? "firing" : "flight";
    const chronoText = state.upgrades && s.chrono.v && state.shotT >= s.chrono.t2 ? ` · chronograph ${MODEL.fmt.mps(s.chrono.v)}` : "";
    return `${tag} · t ${(state.shotT * 1e3).toFixed(2)} ms · ${MODEL.fmt.a(q.i)} · bank ${MODEL.fmt.v(q.vc)} · slug ${MODEL.fmt.mps(Math.max(0, q.v))}${chronoText}`;
  }
  if (state.landed && state.clock - state.landed.at < 3) return state.landed.inBox ? `landed in the catch box · ${MODEL.fmt.mps(state.landed.v)}${state.upgrades ? " (chronograph)" : ""}` : "the slug stopped in the barrel: the coil pulled it back";
  if (state.stickOn) return state.vBank < SAFE_V ? `safe · stick on · ${V} · hands allowed` : `discharging · stick on · ${V}`;
  if (connected()) return state.vBank < vFull() - 0.05 ? `charging · ${V} · ${E}` : `charged · ${V} · ${E} · open the disconnect (K), then fire`;
  if (state.vBank >= SAFE_V) return `${state.supplyOn ? "disconnected" : "supply off"} · ${V} · bleeder draining · ready to fire`;
  return `safe · ${V} · under 5 V`;
}
let lastReadout = "", scopeDirty = true;
function refreshLive() {
  let text = phaseText();
  if (state.warn && state.clock < state.warnUntil) text = `${text} — ${state.warn}`;
  if (text !== lastReadout) { $("[data-readout]").textContent = text; lastReadout = text; }
  const scrub = $("#scrub");
  if (state.shot && document.activeElement !== scrub) scrub.value = String(Math.round((Math.min(state.shotT, state.shot.end) / state.shot.end) * 1000));
  if (state.shot || scopeDirty) drawScope();
}
function announce() {
  $("[data-status]").textContent = phaseText();
  stage.setAttribute("aria-valuenow", String(p.vSet));
  stage.setAttribute("aria-valuetext", `${phaseText()}; supply set to ${MODEL.fmt.v(p.vSet)}`);
  const set = (sel, t, on) => { const b = $(sel); if (b) { b.textContent = t; b.setAttribute("aria-pressed", on ? "true" : "false"); } };
  set("[data-action='supply']", state.supplyOn ? "Supply output: on" : "Supply output: off", state.supplyOn);
  set("[data-action='knife']", state.knifeClosed ? "Disconnect: closed" : "Disconnect: open", state.knifeClosed);
  set("[data-action='stick']", state.stickOn ? "Hang up discharge stick" : "Clip on discharge stick", state.stickOn);
}
function refreshReadouts() {
  const d = derived;
  if (!d) return;
  const out = {
    C: `${(d.C * 1e6).toFixed(0)} µF`, full: MODEL.fmt.v(vFull()), E: MODEL.fmt.j(d.energy), charge: MODEL.fmt.s(d.chargeTime),
    peak: MODEL.fmt.a(d.peakI), zero: MODEL.fmt.ms(d.scrTime ?? 0), pulse: MODEL.fmt.ms(d.pulse),
    tau: MODEL.fmt.s(d.bleedTau), bleed: MODEL.fmt.s(d.bleedTo5), stick: MODEL.fmt.s(d.stickTo5), watts: MODEL.fmt.w(d.bleedWatts),
    exit: MODEL.fmt.mps(Math.max(0, d.exitV)), kinetic: `${(0.5 * p.mass * Math.max(0, d.exitV) ** 2).toFixed(2)} J`, eff: MODEL.fmt.pct(Math.max(0, d.efficiency)),
    chrono: chrono && chrono.v ? MODEL.fmt.mps(chrono.v) : "slug does not reach gate 2",
  };
  for (const [k, v] of Object.entries(out)) { const el = $(`[data-out="${k}"]`); if (el) el.textContent = v; }
  const wattsEl = $('[data-out="watts"]');
  if (wattsEl) { wattsEl.classList.toggle("warn", d.bleedWatts > p.bleedW); wattsEl.title = d.bleedWatts > p.bleedW ? `Over the bleeder's ${p.bleedW} W rating` : ""; }
  const chronoRow = $("[data-row='chrono']");
  if (chronoRow) chronoRow.hidden = !state.upgrades;
  const atEnd = MODEL.sampleAt(traceShot, traceShot.pulse);
  const inCoil = Math.abs(atEnd.x - p.coilAt) < (p.coilLen + p.slugLen) / 2;
  const w = $("#suckback");
  if (w) {
    w.hidden = !(inCoil || d.exitV < 1);
    w.textContent = d.exitV < 1 ? "The slug does not leave: it is pulled back into the coil. Move its start, lighten it or shorten the pulse." : `At the end of the pulse the slug is still in the coil, so the tail pulls it back (the guide's suck-back). Try the nose closer to the coil's mouth.`;
  }
}
function labelText(m) {
  const l = m.userData.label;
  return { name: l.name, value: valueFor(l.name) ?? l.value, role: l.role };
}
function valueFor(name) {
  const d = derived;
  switch (name) {
    case "Capacitor C1": case "Capacitor C2": return `${(p.capEach * 1e6).toFixed(0)} µF 63 V · ${p.caps} in parallel = ${(d.C * 1e6).toFixed(0)} µF`;
    case "Bleeder resistor": return `${(p.bleedR / 1e3).toFixed(p.bleedR >= 1e3 ? 0 : 1)} kΩ ${p.bleedW} W · to 5 V in ${MODEL.fmt.s(d.bleedTo5)}`;
    case "Coil": return `${(p.L * 1e6).toFixed(0)} µH, ${(p.coilLen * 1e3).toFixed(0)} mm · peak ${MODEL.fmt.a(d.peakI)}`;
    case "Slug": return `${(p.mass * 1e3).toFixed(0)} g, ${(p.slugLen * 1e3).toFixed(0)} mm · leaves at ${MODEL.fmt.mps(Math.max(0, d.exitV))}`;
    case "Push switch": return `carries ${MODEL.fmt.a(d.peakI)} peak for ${MODEL.fmt.ms(d.scrTime ?? 0)}`;
    case "SCR (thyristor)": return `peak ${MODEL.fmt.a(d.peakI)} · on for ${MODEL.fmt.ms(d.scrTime ?? 0)}`;
    case "Flyback diode": return `carries the tail from ${MODEL.fmt.ms(d.scrTime ?? 0)} to ${MODEL.fmt.ms(d.pulse)}`;
    case "Bench power supply": return `set ${MODEL.fmt.v(p.vSet)}, ${p.chargeI.toFixed(1)} A limit · charges in ${MODEL.fmt.s(d.chargeTime)}`;
    case "Multimeter": case "Multimeter display": return `reads ${state.vBank.toFixed(2)} V`;
    case "Terminal block": return `${MODEL.fmt.j(d.energy)} at ${MODEL.fmt.v(vFull())} (55 V less the diode)`;
    case "Discharge stick": return `100 Ω, 10 W · bank to 5 V in ${MODEL.fmt.s(d.stickTo5)}`;
    case "Optical gate 1": case "Optical gate 2": return chrono && chrono.v ? `chronograph reads ${MODEL.fmt.mps(chrono.v)}` : null;
    default: return null;
  }
}
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2(-9, -9);
let hovered = null;
function pick() {
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(S.pickables, false);
  const hit = hits.find((h) => isShown(h.object) && (!h.object.material.transparent || h.object.material.opacity > 0.2));
  const m = hit ? hit.object : null;
  if (m !== hovered) {
    if (hovered) setHighlight(hovered, false);
    hovered = m;
    state.hover = m;
    if (m) { setHighlight(m, true); showTip(m); } else hideTip();
  }
  if (hovered) positionTip(hovered);
}
const highlighted = new Map();
const NO_GLOW = new Set(["Workbench", "Base plate", "Plywood backstop", "Catch box", "Towels"]);
function setHighlight(m, on) {
  if (NO_GLOW.has(m.userData.label.name)) return;
  const same = S.pickables.filter((o) => o.userData.label && o.userData.label.name === m.userData.label.name);
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
const tmp = new THREE.Vector3(), bbox = new THREE.Box3();
function positionTip(m) {
  bbox.setFromObject(m);
  bbox.getCenter(tmp);
  tmp.y = bbox.max.y;
  tmp.project(camera);
  const r = canvas.getBoundingClientRect();
  tooltip.style.left = `${Math.max(8, Math.min(r.width - 8, (tmp.x * 0.5 + 0.5) * r.width))}px`;
  tooltip.style.top = `${Math.max(8, (-tmp.y * 0.5 + 0.5) * r.height - 10)}px`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tags = Object.entries(S.anchors).map(([id, at]) => {
  const el = document.createElement("div");
  el.className = "cg3-tag";
  el.textContent = S.GROUP_INFO[id].title;
  el.hidden = true;
  tagsHost.appendChild(el);
  return { id, at, el };
});
function placeTags() {
  const r = canvas.getBoundingClientRect();
  for (const t of tags) {
    const later = t.id === "sensing" || t.id === "pcb";
    const show = state.labelsAll && (!later || state.upgrades);
    t.el.hidden = !show;
    if (!show) continue;
    tmp.copy(t.at).add(groups[t.id].position).project(camera);
    if (tmp.z > 1) { t.el.hidden = true; continue; }
    t.el.style.left = `${(tmp.x * 0.5 + 0.5) * r.width}px`;
    t.el.style.top = `${(-tmp.y * 0.5 + 0.5) * r.height}px`;
  }
}

// ---------------------------------------------------------------- oscilloscope
function drawScope() {
  const c = scopeCanvas, g = c.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h || !traceShot) return;
  if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(root);
  const ink = css.getPropertyValue("--fg").trim() || "#ccc";
  const grid = css.getPropertyValue("--grid").trim() || "#444";
  g.clearRect(0, 0, w, h);
  const s = state.shot ?? traceShot;
  const T = s.end;
  const pad = { l: 6, r: 6, t: 8, b: 16 };
  const X = (t) => pad.l + (Math.min(t, T) / T) * (w - pad.l - pad.r);
  const Y = (f) => pad.t + (1 - f) * (h - pad.t - pad.b);
  g.strokeStyle = grid; g.lineWidth = 1; g.beginPath();
  for (let i = 0; i <= 4; i++) { const y = Y(i / 4); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); }
  for (let ms = 0; ms * 1e-3 <= T; ms += 1) { const x = X(ms * 1e-3); g.moveTo(x, pad.t); g.lineTo(x, h - pad.b); }
  g.stroke();
  const v0 = Math.max(1, s.vc[0]);
  const trace = (arr, norm, color) => {
    g.strokeStyle = color; g.lineWidth = 1.6; g.beginPath();
    for (let i = 0; i < s.t.length; i++) { const x = X(s.t[i]), y = Y(Math.max(0, Math.min(1, arr[i] / norm))); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  };
  trace(s.i, Math.max(1, s.peakI), "#ff7a2a");
  trace(s.vc, v0, "#4f8dff");
  trace(s.x, p.barrelLen, "#3ddc84");
  if (state.shot) { const x = X(state.shotT); g.strokeStyle = ink; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, h - pad.b); g.stroke(); g.setLineDash([]); }
  g.fillStyle = ink; g.font = "10px ui-monospace, monospace";
  g.textAlign = "left"; g.fillText("0", pad.l, h - 4);
  g.textAlign = "right"; g.fillText(`${(T * 1e3).toFixed(1)} ms`, w - pad.r, h - 4);
  g.textAlign = "left";
  g.fillStyle = "#ff7a2a"; g.fillText(`coil current  ${MODEL.fmt.a(s.peakI)} peak`, pad.l + 4, pad.t + 10);
  g.fillStyle = "#4f8dff"; g.fillText(`bank voltage  ${MODEL.fmt.v(v0)}`, pad.l + 4, pad.t + 22);
  g.fillStyle = "#3ddc84"; g.fillText(`slug position  0 to ${(p.barrelLen * 1e3).toFixed(0)} mm`, pad.l + 4, pad.t + 34);
  scopeDirty = false;
}

// ---------------------------------------------------------------- camera presets
const PRESETS = {
  overview: { pos: W(260, 1080, 760), target: W(170, -40, 40) },
  charging: { pos: W(300, 120, 300), target: W(130, -60, 30) },
  bank: { pos: W(170, 210, 200), target: W(90, 33, 35) },
  switch: { pos: W(-30, 210, 170), target: W(-95, 30, 20) },
  coil: { pos: W(-20, 150, 140), target: W(-95, -30, 32) },
  catch: { pos: W(250, 420, 330), target: W(470, -40, 60) },
  top: { pos: W(150, 40, 1250), target: W(150, -40, 0) },
};
let camAnim = null;
function goTo(name) {
  const pr = PRESETS[name];
  if (!pr) return;
  camAnim = { from: camera.position.clone(), to: pr.pos.clone(), tf: controls.target.clone(), tt: pr.target.clone(), start: performance.now() };
}
function stepCamera() {
  if (!camAnim) return;
  const t = still.matches ? 1 : Math.min(1, (performance.now() - camAnim.start) / 900);
  const e = t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(camAnim.from, camAnim.to, e);
  controls.target.lerpVectors(camAnim.tf, camAnim.tt, e);
  if (t >= 1) camAnim = null;
}

// ---------------------------------------------------------------- the panel
const CONTROLS = [
  { section: "Circuit (guide values)", items: [
    { id: "vSet", label: "Supply set voltage", min: 5, max: 55, step: 1, unit: "V", get: () => p.vSet, set: (v) => (p.vSet = v), note: "Taped at 55 V: the capacitors are rated 63 V." },
    { id: "caps", label: "Capacitors in parallel", min: 1, max: 4, step: 1, unit: "", get: () => p.caps, set: (v) => (p.caps = v) },
    { id: "capEach", label: "Capacitance each", min: 1000, max: 22000, step: 500, unit: "µF", get: () => p.capEach * 1e6, set: (v) => (p.capEach = v * 1e-6) },
    { id: "L", label: "Coil inductance", min: 20, max: 300, step: 5, unit: "µH", get: () => p.L * 1e6, set: (v) => (p.L = v * 1e-6) },
    { id: "R", label: "Loop resistance", min: 20, max: 300, step: 5, unit: "mΩ", get: () => p.R * 1e3, set: (v) => (p.R = v * 1e-3) },
    { id: "chargeI", label: "Supply current limit", min: 0.2, max: 3, step: 0.1, unit: "A", get: () => p.chargeI, set: (v) => (p.chargeI = v) },
    { id: "bleedR", label: "Bleeder resistor", min: 0.2, max: 10, step: 0.1, unit: "kΩ", get: () => p.bleedR / 1e3, set: (v) => (p.bleedR = v * 1e3) },
  ], outs: [["C", "Bank capacitance"], ["full", "Bank when full (after the diode)"], ["E", "Stored energy"], ["charge", "Charge time"], ["peak", "Peak coil current"], ["zero", "Bank at 0 V"], ["pulse", "Pulse ends (5 %)"], ["tau", "Bleed time constant"], ["bleed", "Bleeder: to 5 V"], ["stick", "Discharge stick: to 5 V"], ["watts", "Bleeder at full charge"]] },
  { section: "Coil, barrel, slug", items: [
    { id: "mass", label: "Slug mass", min: 5, max: 40, step: 0.5, unit: "g", get: () => p.mass * 1e3, set: (v) => (p.mass = v * 1e-3) },
    { id: "slugLen", label: "Slug length", min: 15, max: 50, step: 1, unit: "mm", get: () => p.slugLen * 1e3, set: (v) => (p.slugLen = v * 1e-3) },
    { id: "coilLen", label: "Coil length", min: 20, max: 60, step: 2, unit: "mm", get: () => p.coilLen * 1e3, set: (v) => (p.coilLen = v * 1e-3) },
    { id: "noseIn", label: "Slug nose inside the coil", min: -10, max: 30, step: 1, unit: "mm", get: () => p.noseIn * 1e3, set: (v) => (p.noseIn = v * 1e-3), note: "The guide's rule is 1 to 2 cm; week 5 finds the sweet spot." },
    { id: "k", label: "Force constant k (assumed)", min: 0.0001, max: 0.001, step: 0.00001, unit: "N/A²", get: () => p.k, set: (v) => (p.k = v), fmt: (v) => v.toExponential(1) },
  ], outs: [["exit", "Exit velocity"], ["kinetic", "Kinetic energy"], ["eff", "Efficiency"], ["chrono", "Chronograph (gates 1 → 2)"]], note: "suckback" },
];
const fmtVal = (it, v) => `${it.fmt ? it.fmt(v) : Number(v.toFixed(3))} ${it.unit}`.trim();
function syncSliders() { for (const sec of CONTROLS) for (const it of sec.items) { const el = $(`#ctl-${it.id}`); if (el) { el.value = it.get(); el.nextElementSibling.textContent = fmtVal(it, it.get()); } } }
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
      row.innerHTML = `<span class="n">${it.label}</span><input id="ctl-${it.id}" type="range" min="${it.min}" max="${it.max}" step="${it.step}" value="${it.get()}"><output for="ctl-${it.id}">${fmtVal(it, it.get())}</output>`;
      const input = row.querySelector("input");
      input.addEventListener("input", () => { const v = Number(input.value); it.set(v); row.querySelector("output").textContent = fmtVal(it, v); if (it.id === "noseIn" || it.id === "slugLen" || it.id === "coilLen") { if (!state.shot) placeSlugAt(slugStartOf(p) + p.slugLen / 2); } recompute(); announce(); takeOver(); });
      body.appendChild(row);
      if (it.note) { const n = document.createElement("p"); n.className = "cg3-note"; n.textContent = it.note; body.appendChild(n); }
    }
    const grid = document.createElement("div");
    grid.className = "cg3-outs";
    grid.innerHTML = sec.outs.map(([k, l]) => `<span class="k" data-row="${k}">${l}</span><span class="o" data-out="${k}" data-row="${k}">–</span>`).join("");
    body.appendChild(grid);
    if (sec.note === "suckback") { const w = document.createElement("p"); w.id = "suckback"; w.className = "cg3-warn"; w.hidden = true; body.appendChild(w); }
    d.appendChild(body);
    frag.appendChild(d);
  }
  panelEl.querySelector("[data-controls]").appendChild(frag);
  $("#speed").innerHTML = SPEEDS.map((s, i) => `<option value="${i}"${i === state.speed ? " selected" : ""}>${s.label}</option>`).join("");
  $("#speed").addEventListener("change", (e) => { state.speed = Number(e.target.value); });
  $("#scrub").addEventListener("input", (e) => {
    if (!state.shot && !fire()) return;
    state.paused = true;
    state.shotT = (Number(e.target.value) / 1000) * state.shot.end;
    takeOver();
  });
  for (const b of document.querySelectorAll("[data-action]")) b.addEventListener("click", () => { act(b.dataset.action); takeOver(); });
  $("#explode").addEventListener("input", (e) => { state.explode = Number(e.target.value) / 100; takeOver(); });
  $("#autorotate").addEventListener("change", (e) => { state.autoRotate = e.target.checked; });
  $("#labels").addEventListener("change", (e) => { state.labelsAll = e.target.checked; });
  $("#upgrades").addEventListener("change", (e) => { state.upgrades = e.target.checked; applyUpgrades(); takeOver(); });
  $("#shadows").addEventListener("change", (e) => { renderer.shadowMap.enabled = e.target.checked; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); });
  $("#theme").addEventListener("change", (e) => applyTheme(e.target.checked ? "light" : "dark"));
  for (const b of document.querySelectorAll("[data-view]")) b.addEventListener("click", () => { goTo(b.dataset.view); takeOver(); });
  $("#follow").addEventListener("change", (e) => { state.follow = e.target.checked; if (!state.follow) goTo("coil"); });
  $("#toggle-panel").addEventListener("click", () => { panelEl.classList.toggle("collapsed"); onResize(); });
}
function act(name) {
  switch (name) {
    case "supply": setSupply(!state.supplyOn); break;
    case "knife": setKnife(!state.knifeClosed); break;
    case "fire": fire(); break;
    case "stick": setStick(!state.stickOn); break;
    case "pause": if (state.shot) state.paused = !state.paused; break;
    case "reset": resetAll(); break;
    case "guide": Object.assign(p, GUIDE); syncSliders(); if (!state.shot) placeSlugAt(slugStartOf(p) + p.slugLen / 2); recompute(); announce(); break;
    case "resetview": goTo("overview"); break;
  }
}

// ---------------------------------------------------------------- tour: the guide's sequence on a loop
function tourTick(dt) {
  state.tourAt += dt;
  const next = () => { state.tourStep++; state.tourAt = 0; };
  switch (state.tourStep) {
    case 0: if (state.tourAt > 0.8) { if (state.stickOn) setStick(false); setSupply(true); setKnife(true); next(); } break;
    case 1: if (connected() && state.vBank >= vFull() - 0.05 && state.tourAt > 0.8) { setKnife(false); next(); } break;
    case 2: if (state.tourAt > 0.9) { fire(); next(); } break;
    case 3: if (!state.shot && state.tourAt > 1.6) { setStick(true); next(); } break;
    case 4: if (state.vBank < SAFE_V && state.tourAt > 2.2) { setStick(false); next(); } break;
    default: if (state.tourAt > 1.4) { state.tourStep = 0; state.tourAt = 0; }
  }
}
let idleTimer = 0;
function takeOver() {
  state.tour = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches && !state.shot) { state.tour = true; state.tourStep = 0; state.tourAt = 0; } }, 20000);
}

// ---------------------------------------------------------------- loop, input, resize
let last = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  state.clock += dt;
  if (state.tour && !still.matches) tourTick(dt);
  stepMachine(dt, still.matches);
  stepCamera();
  pick();
  draw();
  requestAnimationFrame(tick);
}
function onResize() {
  const r = stage.getBoundingClientRect();
  const w = Math.max(200, r.width), h = Math.max(200, r.height);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 58 : 34; // a portrait phone sees the whole bench too
  camera.updateProjectionMatrix();
  scopeDirty = true;
}
addEventListener("resize", onResize);
new ResizeObserver(onResize).observe(stage);
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
});
canvas.addEventListener("pointerleave", () => pointer.set(-9, -9));
let downAt = null;
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener("click", (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4 || !hovered) return;
  const name = hovered.userData.label.name;
  const acts = { "Fire button (green)": "fire", "Push switch": "fire", "SW1 fire button": "fire", "Disconnect switch (knife switch)": "knife", "Supply output button": "supply", "Discharge stick": "stick" };
  if (acts[name]) { act(acts[name]); takeOver(); }
});
stage.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 1 : 5;
  const setV = (v) => { p.vSet = Math.min(55, Math.max(5, v)); syncSliders(); recompute(); announce(); };
  let handled = true;
  switch (e.key) {
    case "ArrowUp": case "ArrowRight": setV(p.vSet + step); break;
    case "ArrowDown": case "ArrowLeft": setV(p.vSet - step); break;
    case "Home": setV(5); break;
    case "End": setV(55); break;
    case " ": case "Enter": act("fire"); break;
    case "s": case "S": act("supply"); break;
    case "k": case "K": act("knife"); break;
    case "d": case "D": act("stick"); break;
    case "p": case "P": act("pause"); break;
    case "u": case "U": state.upgrades = !state.upgrades; $("#upgrades").checked = state.upgrades; applyUpgrades(); break;
    case "l": case "L": state.labelsAll = !state.labelsAll; $("#labels").checked = state.labelsAll; break;
    case "r": case "R": goTo("overview"); break;
    case "Escape": setKnife(false); setSupply(false); break;
    default: handled = false;
  }
  if (!handled) return;
  e.preventDefault();
  takeOver();
});

buildPanel();
window.__cg3 = { camera, controls, state, live, p, goTo, PRESETS, act };
applyTheme(theme);
$("#theme").checked = theme === "light";
camera.position.copy(PRESETS.overview.pos);
controls.target.copy(PRESETS.overview.target);
controls.update();
placeSlugAt(slugStartOf(p) + p.slugLen / 2);
applyUpgrades();
recompute();
announce();
onResize();
if (still.matches) { state.tour = false; state.supplyOn = true; state.vBank = vFull(); announce(); }
requestAnimationFrame(tick);
