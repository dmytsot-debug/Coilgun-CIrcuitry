const D = __DATA__;
const P = D.P;
const p = { ...MODEL.DEFAULTS };
const stage = document.querySelector(".cg-stage");
const svgs = [...stage.querySelectorAll("svg")];
const $ = (sel) => stage.querySelector(sel);
const $$ = (sel) => [...stage.querySelectorAll(sel)];
const readout = document.querySelector("[data-readout]");
const status = $("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIGHT = document.body.dataset.theme === "light" ? 1 : 0;
const at = (q) => iso(q, P);

const el = {
  needle: $('[data-part="needle"]'),
  knobIndex: $('[data-part="knob-index"]'),
  button: $('[data-part="button"]'),
  key: $('[data-part="key"]'),
  slug: $('[data-part="slug"]'),
  field: $('[data-part="field"]'),
  led: Object.fromEntries($$(".cg-led").map((g) => [g.dataset.led, g])),
  scr: $$('[data-part="scr"]'),
  diode: $$('[data-part="diode"]'),
  loop: $$("[data-loop]"),
  gate: $$("[data-gate]").sort((a, b) => a.dataset.chunk - b.dataset.chunk),
};

// ---------------------------------------------------------------- time scaling for the display
const PULSE_SLOW = 200; // the discharge is shown 200× slower than life
const BLEED_FAST = 17; // the bleed is shown 17× faster than life
const CHARGE_FAST = 1; // charging runs in real time

// ---------------------------------------------------------------- state
const state = {
  power: false, // key switch
  vSet: p.vSet,
  vBank: 0,
  phase: "off", // off | charging | armed | firing | bleeding
  shot: null, // MODEL.shot result while firing
  shotT: 0, // model seconds into the shot
  firedAt: -99,
  press: { x: 0, v: 0 }, // button travel 0..1
  keyTurn: { x: 0, v: 0 }, // 0 = off, 1 = on
  knob: { x: 0, v: 0 }, // eased vSet
  needle: { x: 0, v: 0 },
  glow: { x: 0, v: 0 },
  slugX: 0, // world offset along the barrel
  slugV: 0,
  clock: 0,
};
const derivedFor = (v) => MODEL.derived(p, v);
let derived = derivedFor(state.vSet);

// ---------------------------------------------------------------- shader: the coil's field
const FRAGMENT = `
uniform float uField;   // 0..1, current squared, normalised
uniform float uLight;
const vec3 AXIS0 = vec3(${D.coil.s0.toFixed(2)}, ${D.coil.y.toFixed(2)}, ${D.coil.z.toFixed(2)});
const float LEN = ${(D.coil.s1 - D.coil.s0).toFixed(2)};
const float RC = ${D.coil.rOut.toFixed(2)};
vec4 over(vec4 top, vec4 under){ return top + under * (1. - top.a); }
void main(){
  if (uField < 0.0005) { gl_FragColor = vec4(0.); return; }
  vec2 vb = viewOf(gl_FragCoord.xy);
  vec3 p0 = rayOf(vb);
  vec3 Vd = towardViewer();
  // distance from the pixel ray to the coil axis (the x axis through AXIS0), and where along it
  vec3 d = vec3(1., 0., 0.);
  vec3 n = cross(Vd, d);
  float nl = length(n);
  float dist = abs(dot(p0 - AXIS0, n)) / nl;
  // the point on the axis nearest the ray
  vec3 w = p0 - AXIS0;
  float b = dot(Vd, d);
  float tAxis = (dot(w, d) - dot(w, Vd) * b) / (1. - b * b);
  float along = tAxis / LEN;
  // a toroidal field: strongest at the coil's bore ends, soft everywhere, zero well before any bound
  float sig = RC * 1.15;
  float body = exp(-pow(dist / sig, 2.));
  float ends = 0.55 * (exp(-pow((tAxis - 0.) / (RC * 0.9), 2.)) + exp(-pow((tAxis - LEN) / (RC * 0.9), 2.))) * exp(-pow(dist / (RC * 1.8), 2.));
  float span = window(along, -0.95, 1.95, 0.45);
  float e = (body * 0.8 + ends) * span * uField;
  e *= window(vb.x, 20., uView.x - 20., 20.) * window(vb.y, 20., uView.y - 20., 20.);
  float m = 1. - exp(-1.6 * e);
  // dark: cool light added; light: a saturated blue ink with a pale core, solved for paper
  vec3 darkCol = tonemap(vec3(.42, .58, 1.) * e * 1.3, 1.1);
  float da = max(darkCol.r, max(darkCol.g, darkCol.b));
  vec4 dark = vec4(darkCol, da);
  vec3 seen = mix(vec3(1.), vec3(.36, .5, .97), smoothstep(0., .55, m));
  seen = mix(seen, vec3(.86, .9, 1.), smoothstep(.6, .95, m));
  vec3 absorbed = 1. - seen;
  float la = max(max(absorbed.r, max(absorbed.g, absorbed.b)), .55 * smoothstep(.6, .95, m));
  la *= smoothstep(0., .06, m);
  vec4 light = vec4(vec3(la) - absorbed, la);
  light.rgb = min(light.rgb, vec3(light.a));
  vec4 col = mix(dark, light, uLight);
  float g = max(col.a, max(col.r, max(col.g, col.b)));
  float nz = (hash12(gl_FragCoord.xy + fract(uTime * .61) * 91.) + hash12(gl_FragCoord.yx * 1.37 + fract(uTime * .37) * 57.) - 1.) / 255.;
  col = max(col + nz * smoothstep(0., 1.5 / 255., g), 0.);
  gl_FragColor = col;
}`;
const layer = glLayer({ canvas: stage.querySelector(".cg-gl"), fragment: FRAGMENT, view: [D.W, D.H], camera: D.camera, uniforms: ["uField"], fixed: { uLight: LIGHT } });
if (layer) stage.setAttribute("data-gl", "");

// ---------------------------------------------------------------- drawing helpers
const knobIndexAt = (v) => {
  const share = (v - p.vMin) / (p.vMax - p.vMin);
  const a = (-135 + 270 * share) * (Math.PI / 180);
  const c = D.knob.c;
  const face = c[1] + 0.8 + D.knob.len + 0.02;
  const r = D.knob.r - 0.6;
  return pathOf([at([c[0], face, c[2]]), at([c[0] + Math.sin(a) * r, face, c[2] + Math.cos(a) * r])]);
};
const needleAt = (share) => {
  const a = -Math.PI * 0.75 + share * Math.PI * 1.5;
  const [x, y] = D.meter.c, top = D.meter.z + D.meter.h + 0.2;
  return lineOnTop([x - Math.sin(a) * 1.6, y + Math.cos(a) * 1.6], [x + Math.sin(a) * (D.meter.r - 2.4), y - Math.cos(a) * (D.meter.r - 2.4)], top, P);
};
const keyBladeAt = (turn) => {
  const a = -Math.PI / 2 + turn * (Math.PI / 2);
  const [x, y] = D.key.c, top = D.key.top;
  const d = [Math.cos(a), Math.sin(a)];
  const n = [-d[1], d[0]];
  const plan = D.key.blade.map(([u, v]) => [x + d[0] * u + n[0] * v, y + d[1] * u + n[1] * v]);
  return solidSvg(extrude(plan, top, D.key.h, P, { convex: true }), { tone: "hi", crease: "lo" });
};

const words = {
  off: () => `off · bank ${MODEL.fmt.v(state.vBank)}`,
  charging: () => `charging · ${MODEL.fmt.v(state.vBank)} · ${MODEL.fmt.j(MODEL.energy(p, state.vBank))}`,
  armed: () => `armed · ${MODEL.fmt.v(state.vBank)} · ${MODEL.fmt.j(MODEL.energy(p, state.vBank))} · pulse ${MODEL.fmt.ms(derived.pulse)}`,
  firing: () => {
    const q = MODEL.sampleAt(state.shot, state.shotT);
    return `firing · ${MODEL.fmt.a(q.i)} · ${MODEL.fmt.v(q.vc)} · slug ${MODEL.fmt.mps(Math.max(0, q.v))}`;
  },
  bleeding: () => `bleeding · ${MODEL.fmt.v(state.vBank)} · 50 V in ${MODEL.fmt.s(MODEL.bleedTimeTo(p, state.vBank, p.vMin))}`,
};
let lastSaid = "";
function say() {
  const text = words[state.phase]();
  if (text !== lastSaid) { readout.textContent = text; lastSaid = text; }
}
let lastPhase = "";
function describe() {
  const d = derived;
  const text = `${state.phase}: set ${MODEL.fmt.v(state.vSet)}, ${MODEL.fmt.j(d.energy)} stored at full charge, bank ${MODEL.fmt.v(state.vBank)}`;
  stage.setAttribute("aria-valuenow", String(Math.round(state.vSet)));
  stage.setAttribute("aria-valuetext", text);
  if (state.phase !== lastPhase) { lastPhase = state.phase; if (document.activeElement === stage) status.textContent = state.phase; }
}

let lastKey = -1, lastField = -1, lastBladeHtml = "";
function draw() {
  el.needle.setAttribute("d", needleAt(Math.min(1, state.needle.x / p.vMax)));
  el.knobIndex.setAttribute("d", knobIndexAt(state.knob.x));
  const press = state.press.x;
  if (press > 0.002) el.button.setAttribute("transform", translateAlong(P, [0, 0, -D.button.drop * press]));
  else el.button.removeAttribute("transform");
  const blade = keyBladeAt(state.keyTurn.x);
  if (blade !== lastBladeHtml) { el.key.innerHTML = blade; lastBladeHtml = blade; }
  if (state.slugX > 0.001) el.slug.setAttribute("transform", translateAlong(P, [state.slugX, 0, 0]));
  else el.slug.removeAttribute("transform");
  // lamps and conducting parts
  const on = (node, flag) => (flag ? node.setAttribute("data-on", "") : node.removeAttribute("data-on"));
  on(el.led.charge, state.phase === "charging");
  on(el.led.mcu, state.power);
  const firing = state.phase === "firing";
  const scrOn = firing && state.shot && state.shotT < state.shot.diodeAt;
  const diodeOn = firing && state.shot && state.shotT >= state.shot.diodeAt && state.shotT < state.shot.pulse;
  el.scr.forEach((n) => on(n, scrOn));
  el.diode.forEach((n) => on(n, diodeOn));
  el.loop.forEach((n) => (firing && state.shotT < state.shot.pulse ? n.setAttribute("data-live", "") : n.removeAttribute("data-live")));
  // the gate pulse runs along its cable in the first 120 ms after the trigger
  const age = state.clock - state.firedAt;
  const reach = still.matches ? (age > 0 && age < 0.4 ? 1 : 0) : smooth(0, 0.14, age) * (age < 0.5 ? 1 : 1 - smooth(0.5, 0.75, age));
  el.gate.forEach((n, i) => (reach > 0 && i / el.gate.length < reach ? n.setAttribute("data-hot", "") : n.removeAttribute("data-hot")));
  on(el.led.gate, age > 0 && age < 0.6);
  // the coil's field
  const field = state.glow.x;
  if (Math.abs(field - lastField) > 1e-4) {
    lastField = field;
    if (layer) field > 5e-4 ? layer.draw({ uField: field }, still.matches ? 0.8 : state.clock) : layer.clear();
    if (el.field) el.field.style.opacity = (Math.min(1, field) * (LIGHT ? 0.32 : 0.5)).toFixed(3);
  }
  say();
}

// ---------------------------------------------------------------- the machine
function setPower(flag, { fromTour = false } = {}) {
  if (state.power === flag) return;
  state.power = flag;
  if (flag) {
    state.phase = state.vBank >= state.vSet - 0.5 ? "armed" : "charging";
  } else if (state.phase !== "firing") {
    state.phase = "bleeding";
  }
  describe();
  run();
}
function setVoltage(v) {
  state.vSet = Math.round(Math.min(p.vMax, Math.max(p.vMin, v)));
  p.vSet = state.vSet;
  derived = derivedFor(state.vSet);
  if (state.power && state.phase !== "firing") state.phase = state.vBank >= state.vSet - 0.5 ? "armed" : "charging";
  describe();
  run();
}
function fire() {
  if (state.phase !== "armed" || state.vBank < p.vMin) return false;
  state.shot = MODEL.shot(p, state.vBank);
  state.shotT = 0;
  state.phase = "firing";
  state.firedAt = state.clock;
  state.slugX = 0;
  describe();
  run();
  return true;
}
function stepMachine(dt, calm) {
  const C = MODEL.capacitance(p);
  switch (state.phase) {
    case "charging":
      state.vBank = MODEL.charge(state.vBank, p, dt * CHARGE_FAST);
      if (state.vBank >= state.vSet - 1e-6) { state.vBank = state.vSet; state.phase = "armed"; describe(); }
      break;
    case "armed":
      if (state.vBank < state.vSet - 0.5) state.phase = "charging";
      break;
    case "firing": {
      state.shotT += dt / PULSE_SLOW;
      const s = state.shot;
      const q = MODEL.sampleAt(s, state.shotT);
      state.vBank = q.vc;
      // slug position in world units: barrel length in metres maps to the drawn barrel
      const scale = (D.slug.barrel.x1 - D.slug.barrel.x0) / p.barrelLen;
      const xWorld = (q.x - p.slugLen / 2) * scale; // slug's rear from the breech face
      state.slugX = Math.min(D.slug.travel + 14, Math.max(0, xWorld));
      if (state.shotT >= s.end || state.slugX >= D.slug.travel + 14) {
        // the slug has left; put the next one in the breech once the field has gone
        if (state.glow.x < 0.01) {
          state.slugX = 0;
          state.phase = state.power ? "charging" : "bleeding";
          state.shot = null;
          describe();
        }
      }
      break;
    }
    case "bleeding":
      state.vBank = MODEL.bleed(state.vBank, p, dt * BLEED_FAST);
      if (state.vBank < 0.5) { state.vBank = 0; state.phase = "off"; describe(); }
      break;
    case "off":
      break;
  }
  // envelopes
  const fieldTarget = state.phase === "firing" && state.shot ? Math.pow(MODEL.sampleAt(state.shot, state.shotT).i / Math.max(1, derivedFor(p.vMax).peakI), 2) : 0;
  settle(state.glow, fieldTarget, dt, 0.06, calm);
  settle(state.needle, state.vBank, dt, 0.22, calm);
  settle(state.knob, state.vSet, dt, 0.18, calm);
  settle(state.press, state.clock - state.firedAt > 0 && state.clock - state.firedAt < 0.35 ? 1 : 0, dt, 0.05, calm);
  settle(state.keyTurn, state.power ? 1 : 0, dt, 0.12, calm);
}

// ---------------------------------------------------------------- idle tour
const TOUR_V = [400, 250, 450];
let tour = { on: !still.matches, step: 0, at: 0, round: 0 };
function tourTick(dt) {
  tour.at += dt;
  const want = (step, when, action) => { if (tour.step === step && tour.at >= when) { action(); tour.step++; tour.at = 0; } };
  want(0, 0.8, () => { setVoltage(TOUR_V[tour.round % TOUR_V.length]); setPower(true, { fromTour: true }); });
  want(1, 0, () => {}); // charging runs on its own
  if (tour.step === 2 && state.phase === "armed" && tour.at >= 1.4) { fire(); tour.step = 3; tour.at = 0; }
  if (tour.step === 3 && state.phase !== "firing" && tour.at >= 1.2) { setPower(false, { fromTour: true }); tour.step = 4; tour.at = 0; }
  if (tour.step === 4 && state.phase === "off" && tour.at >= 1.0) { tour.step = 0; tour.at = 0; tour.round++; }
}

// ---------------------------------------------------------------- loop
let frame = 0, last = 0, visible = false, idleTimer = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  state.clock += dt;
  if (tour.on) tourTick(dt);
  stepMachine(dt, calm);
  draw();
  const settled = !tour.on && (state.phase === "off" || state.phase === "armed") && state.glow.x === 0 && state.needle.v === 0 && Math.abs(state.needle.x - state.vBank) < 1e-3 && state.press.x === 0 && state.keyTurn.v === 0 && state.knob.v === 0 && state.clock - state.firedAt > 1;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
function takeOver() {
  tour.on = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { tour = { on: true, step: state.power ? 2 : 0, at: 0, round: tour.round + 1 }; run(); } }, 9000);
  run();
}

// ---------------------------------------------------------------- input
stage.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 50 : 10;
  let handled = true;
  switch (event.key) {
    case "ArrowUp": case "ArrowRight": setVoltage(state.vSet + step); break;
    case "ArrowDown": case "ArrowLeft": setVoltage(state.vSet - step); break;
    case "Home": setVoltage(p.vMin); break;
    case "End": setVoltage(p.vMax); break;
    case " ": case "Enter": if (!state.power) setPower(true); else fire(); break;
    case "k": case "K": setPower(!state.power); break;
    case "Escape": setPower(false); break;
    default: handled = false;
  }
  if (!handled) return;
  event.preventDefault();
  takeOver();
});
let drag = null;
const partOf = (target) => target.closest && target.closest("[data-name]");
stage.addEventListener("pointerdown", (event) => {
  const part = partOf(event.target);
  const name = part ? part.dataset.name : "";
  if (name.startsWith("charger.knob")) {
    drag = { y0: event.clientY, v0: state.vSet, id: event.pointerId };
    stage.setPointerCapture(event.pointerId);
    stage.setAttribute("data-grab", "");
    takeOver();
    event.preventDefault();
  }
});
stage.addEventListener("pointermove", (event) => {
  if (!drag) return;
  setVoltage(drag.v0 - (event.clientY - drag.y0) * 2.5);
});
const endDrag = (event) => {
  if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.id)) return;
  drag = null;
  stage.removeAttribute("data-grab");
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("click", (event) => {
  const part = partOf(event.target);
  if (!part) return;
  const name = part.dataset.name;
  if (name === "gate.button" || name === "gate.button.bezel") { takeOver(); if (!state.power) setPower(true); else fire(); }
  else if (name.startsWith("key.")) { takeOver(); setPower(!state.power); }
});
stage.addEventListener("focus", () => { status.textContent = state.phase; });
stage.addEventListener("pointerenter", () => { if (tour.on) { /* keep touring until a press */ } });
addEventListener("resize", () => { lastField = -1; draw(); });

describe();
draw();
if (still.matches) { state.vBank = state.vSet; state.needle.x = state.vSet; state.knob.x = state.vSet; state.power = true; state.keyTurn.x = 1; state.phase = "armed"; describe(); draw(); }
