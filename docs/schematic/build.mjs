// Coilgun circuit bench: an interactive isometric schematic.
// node build.mjs [--light] [--audit]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { tubePieces, tubeSvg, crossingsOf } from "./kit/tube.mjs";
import * as A from "./kit/audit.mjs";
import { glCamera } from "./kit/gl.mjs";
import { kitScript, glScript } from "./scripts/inline-kit.mjs";
import * as M from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

// ---------------------------------------------------------------- camera
const W = 760;
const H = 400;
const PLATE = { x: -150, y: -62, w: 300, d: 124, r: 8 };
const PLATE_H = 10;
const FOOT_H = 5;
const BARREL = { x0: 50, x1: 150, y: 32, z: 26, r: 6, bore: 5.2 };
const COIL = { s0: 83, s1: 107, rOut: 11 }; // along the barrel (world x)
const GATE_X = 140;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [-142, -44, 30], [BARREL.x1, BARREL.y, BARREL.z + 14], [BARREL.x0, BARREL.y, BARREL.z + 14], [40, -46, 20]],
  W,
  H,
  { pad: 18, azimuth: 30, elevation: 30 },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (pts, style) => k.dotsSvg(pts, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const path3 = (pts, closed = false) => k.pathOf(pts.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;
const UP = [0, 0, 1];
const PX = [1, 0, 0];
const PY = [0, 1, 0];
const vert = (x, y, z) => G.frameOf([x, y, z], UP, PX, PY);
const alongX = (x, y, z) => G.frameOf([x, y, z], PX, PY, UP);
const alongY = (x, y, z) => G.frameOf([x, y, z], PY, PX, UP);
const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---------------------------------------------------------------- recorder and helpers
const R = A.recorder(P);
const record = R.solid;
function put(name, ref, svg, shapes = [], { bias = 0, attrs = "", key, cls = "" } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece: "bench", attrs, cls, ...(key !== undefined ? { key } : {}) });
}
function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.5, steps = 2, bevel = 0, extra = "", inner = "", bias = 0, attrs, cls, owner } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const shape = record(A.slab(plan, z0, z1 - z0, { name, owner }, steps));
  put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs, cls });
  return { plan, shape, top: z1 };
}
function cyl(name, cx, cy, r, z, h, style = {}, { steps, bevel = 0, extra = "", inner = "", bias = 0, attrs, cls, owner } = {}) {
  const n = steps ?? G.stepsFor(r, 16, 72, KS);
  const shape = record(A.cylinder(cx, cy, r, z, h, { name, owner }));
  put(name, [cx, cy, z + h / 2], S(k.cylinder(cx, cy, r, z, h, P, n, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs, cls });
  return shape;
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, steps, rims, bevel = 0, owner, attrs, cls, smooth } = {}) {
  const opts = { bevel, ...(smooth !== undefined ? { smooth } : {}), ...(steps ? { steps } : {}), ...(rims ? { rims } : {}) };
  const paths = G.solidOf(profile, F, P, opts);
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name, owner }));
  put(name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs, cls });
  return shape;
}
function disc(name, F, s0, s1, r, style = {}, options = {}) {
  return turned(name, F, [[s0, r], [s1, r]], style, options);
}
function ringBand(name, F, s0, s1, rIn, rOut, style = {}, { extra = "", inner = "", bias = 0, rims, owner, attrs, cls, steps } = {}) {
  const paths = G.ringBand(s0, s1, rIn, rOut, F, P, { ...(rims ? { rims } : {}), ...(steps ? { steps } : {}) });
  const shape = record(A.ring(F, s0, s1, rIn, rOut, { name, owner }));
  put(name, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(paths, { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs, cls });
  return shape;
}
function prism(name, F, poly, s0, s1, style = {}, { extra = "", inner = "", bias = 0, owner, attrs, cls } = {}) {
  const shape = record(A.prism(F, poly, s0, s1, { name, owner }));
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
  const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  const centre = G.add3(G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.mul3(F.u, cx)), G.mul3(F.v, cy));
  put(name, centre, S(G.prismOf(F, poly, s0, s1, P), { tone: "mid", ...style, inner }) + extra, [shape], { bias, attrs, cls });
  return shape;
}
function ballAt(name, c, r, style = {}, { bias = 0, owner } = {}) {
  const shape = record(A.ball(c, r, { name, owner }));
  put(name, c, S(G.sphereOf(c, r, P, { steps: 24 }), { tone: "mid", ...style }), [shape], { bias });
  return shape;
}
function planeMatrix(o, ex, ey) {
  const p0 = at(o), px = at(G.add3(o, ex)), py = at(G.add3(o, ey));
  const v = (x) => x.toFixed(4);
  return `matrix(${v(px[0] - p0[0])} ${v(px[1] - p0[1])} ${v(py[0] - p0[0])} ${v(py[1] - p0[1])} ${p0[0].toFixed(2)} ${p0[1].toFixed(2)})`;
}
// A closed rounded slot drawn in a vertical face (plane y = const or x = const).
function faceSlot(o, ex, ey, w, h, r = 0.6) {
  const ring = k.roundedPlan({ x: -w / 2, y: -h / 2, w, d: h, r }, 3);
  return path3(ring.map(([u, v]) => G.add3(G.add3(o, G.mul3(ex, u)), G.mul3(ey, v))), true);
}

// Cables: filleted routes with chunks, shells or terminal dots, gaps under clamps.
const CABLES = [];
const CLAMP_HALF = 0.9;
const CLAMPS = [];
function cable(name, points, r = 0.5, { tone = "mid", bend, ends = [true, true], shells = [false, false], maxLength = 14, bias = 0.05, limp = true, touch, bundle, clamps = [], owner, attrs = "" } = {}) {
  const route = G.fillet(points, Math.max(bend ?? r * 2.8, 2.2), 10, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = Math.max(1.8, r * 2.6);
  const gaps = [
    ...clamps.flatMap(({ centre, axis, radius }) => crossingsOf(route, centre, axis, radius).map((s) => [s - CLAMP_HALF - 0.05, s + CLAMP_HALF + 0.05])),
    ...(shells[0] ? [[0, SHELL]] : []),
    ...(shells[1] ? [[total - SHELL, total]] : []),
  ].sort((a, b) => a[0] - b[0]);
  R.route(name, route, r, { gaps, limp, touch: [...(touch ?? []), ...clamps.map((c) => c.name).filter(Boolean)], bundle, owner, rims: shells.map((on) => (on ? r * 2 : r)), piece: "bench" });
  CABLES.push({ name, route, r });
  tubePieces(route, r, P, { maxLength, spacing: Math.max(0.6, Math.min(1.6, r)), gaps }).forEach((piece, index) =>
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }), [A.tube(piece.points, piece.radii)], { bias, attrs: ` data-route="${name}" data-chunk="${index}"${attrs}` }),
  );
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    if (shells[index]) {
      const tangent = G.tangentAlong(route, index ? total : 0);
      const F = G.frameAlong(end, tangent);
      const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
      const outer = index ? s0 : s1;
      const shape = record(A.disc(F, s0, s1, r * 2, { name: `${name}.shell${index}`, owner: name }));
      put(`${name}.shell${index}`, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 2, F, P, { steps: 20, bevel: 0.2 }), { tone: "mid" }) + (G.dot3(G.mul3(F.a, index ? -1 : 1), V) > 0.2 ? Ln(G.circleOf(F, outer, r * 1.1, P, 12), { tone: "faint" }) : ""), [shape], { bias: bias + 0.1 });
    } else if (ends[index]) {
      const size = Math.min(1.1, Math.max(0.5, r * KS * 0.7));
      const tangent = G.tangentAlong(route, index ? total : 0);
      const c = G.add3(end, G.mul3(tangent, (index ? -1 : 1) * (size / KS) * 0.9));
      put(`${name}.end${index}`, c, Dots([at(c)], { size, tone: "hi" }), [A.ball(c, size / KS, { name: `${name}.end${index}`, owner: name })], { bias: bias + 0.15 });
    }
  });
  return route;
}
function clampAt(name, centre, axis, r, { bias = 0.3, bundle } = {}) {
  CLAMPS.push(name);
  const F = G.frameAlong(centre, axis);
  const shape = record(A.disc(F, -CLAMP_HALF, CLAMP_HALF, r, { name, anchor: false, bundle, fitting: true }));
  put(name, centre, S(G.disc(-CLAMP_HALF, CLAMP_HALF, r, F, P, { steps: 20 }), { tone: "mid" }), [shape], { bias });
  return { centre, axis, radius: r };
}
// A cable clamp standing on the plate: a stud and a saddle clamp over a cable at height z.
function plateClamp(name, [x, y], along, r, z, { bundle } = {}) {
  cyl(`${name}.stud`, x, y, 0.9, 0, z - r - 0.6, { tone: "lo" }, { steps: 12 });
  return { ...clampAt(name, [x, y, z], along, r + 0.6, { bundle }), name };
}

// ---------------------------------------------------------------- bench plate
const back = [];
back.push(`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`);
for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
  back.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -4, P, 8), { tone: "faint" }) }));
back.push(Ln(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
const plateScrews = k.corners(PLATE, 10);
back.push(Ln(plateScrews.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
back.push(Dots(plateScrews.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
record(A.slab(PLATE, -PLATE_H, PLATE_H, { name: "stand.plate", ground: true }, 8));
// high-voltage area inlay: a closed outline round the bank, switch and coil
const HV = { x: -90, y: -54, w: 236, d: 90, r: 4 };
back.push(Ln(k.planOutline(HV, 0, P, 4), { tone: "faint" }));
back.push(Ln(k.planOutline(k.insetPlan(HV, 1.2), 0, P, 4), { tone: "faint" }));
// ruler strip along the front edge
const STRIP = { x: PLATE.x + 16, y: PLATE.y + PLATE.d - 11, w: PLATE.w - 32, d: 6, r: 1 };
back.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const ticks = k.topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 4, 5, STRIP.y, 0.6, [1.8, 3.4], P);
back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
back.push(Dots([at([STRIP.x + 2, STRIP.y + 3, 0.6]), at([STRIP.x + STRIP.w - 2, STRIP.y + 3, 0.6])], { size: 0.45 }));
// label plate
const LABEL = { x: -40, y: PLATE.y + PLATE.d - 30, w: 32, d: 13, r: 1.2 };
back.push(S(k.slabOf(LABEL, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.4), 0.8, P, 3), { tone: "faint" }));
back.push(Ln([20, 14, 17].map((w, i) => k.lineOnTop([LABEL.x + 4, LABEL.y + 3.4 + i * 3], [LABEL.x + 4 + w, LABEL.y + 3.4 + i * 3], 0.8, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w - 2.6, LABEL.y + 2.4, 0.8]), at([LABEL.x + LABEL.w - 2.6, LABEL.y + LABEL.d - 2.4, 0.8])], { size: 0.45 }));
back.push(k.faceTextSvg(k.topMatrix([HV.x + 6, HV.y + HV.d - 5], 0, P, "x"), "HV", { size: 3, tone: "lo", anchor: "start" }));

// ---------------------------------------------------------------- block 1: charger
const CH = { x0: -142, x1: -104, y0: -44, y1: -12, z1: 24 };
const chargerBrick = box("charger.case", [CH.x0, CH.y0, 0], [CH.x1, CH.y1, CH.z1], { tone: "mid" }, {
  r: 1.6, steps: 3, bevel: 0.8,
  inner: Ln(k.sideSeam({ x: CH.x0, y: CH.y0, w: CH.x1 - CH.x0, d: CH.y1 - CH.y0, r: 1.6 }, 4, P, 3), { tone: "faint" }),
  extra: Ln([-130, -124, -118].map((x) => faceSlot([x, CH.y1 + 0.02, 15], PX, UP, 2.2, 9, 1)).join(""), { tone: "faint" }) + Dots([at([CH.x0 + 3, CH.y0 + 3, CH.z1]), at([CH.x1 - 3, CH.y0 + 3, CH.z1]), at([CH.x0 + 3, CH.y1 - 3, CH.z1]), at([CH.x1 - 3, CH.y1 - 3, CH.z1])], { size: 0.45 }),
});
// cooling fins on top, rear half
for (let i = 0; i < 7; i++) box(`charger.fin`, [CH.x0 + 3 + i * 4.4, CH.y0 + 2, CH.z1], [CH.x0 + 4.4 + i * 4.4, CH.y0 + 7.5, CH.z1 + 3], { tone: "mid", crease: "none" }, { r: 0.3, steps: 1 });
// voltage knob on the front face
const KNOB = { c: [-112, CH.y1, 10], r: 4.2, len: 3.2 };
const KF = alongY(KNOB.c[0], KNOB.c[1], KNOB.c[2]);
disc("charger.knob.bezel", KF, 0, 0.8, KNOB.r + 1.2, { tone: "lo" });
disc("charger.knob", KF, 0.8, 0.8 + KNOB.len, KNOB.r, { tone: "hi" }, {
  extra: Faded(G.ribsOf(KF, 0.8, 0.8 + KNOB.len, KNOB.r, 28, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) + `<path data-part="knob-index" class="iso-line" data-tone="lit" data-free="end" d="${path3([[KNOB.c[0], KNOB.c[1] + 0.8 + KNOB.len + 0.02, KNOB.c[2]], [KNOB.c[0], KNOB.c[1] + 0.8 + KNOB.len + 0.02, KNOB.c[2] + KNOB.r - 0.6]])}"/>`,
  attrs: ' data-part="knob"',
});
// input jack and power LED on the front face
const JACK = [-134, CH.y1, 8];
disc("charger.jack", alongY(...JACK), 0, 2.4, 2.4, { tone: "lo" }, { extra: `<path class="cg-bore" d="${G.circleOf(alongY(...JACK), 2.42, 1.1, P, 16)}"/>` });
put("charger.led", [-104.5, -20, 20], `<g class="cg-led" data-led="charge">${Dots([at([CH.x1 + 0.02, -20, 20])], { size: 0.9, tone: "hi" })}</g>`, [record(A.ball([CH.x1 + 0.3, -20, 20], 0.6, { name: "charger.led" }))], { bias: 0.4 });
// bank voltmeter on top of the charger
const METER = { c: [-123, -28], r: 7.5, z: CH.z1, h: 5 };
cyl("meter.body", METER.c[0], METER.c[1], METER.r, METER.z, METER.h, { tone: "hi", crease: "lo" }, {
  bevel: 0.6,
  inner: Ln(k.sideArc(METER.c[0], METER.c[1], METER.r, METER.z + 1.4, P, 40), { tone: "faint" }),
  extra: (() => {
    const top = METER.z + METER.h;
    const t = k.radialTicks(METER.c[0], METER.c[1], METER.r - 1.6, 20, 5, top, [1, 2.2], P, -Math.PI * 0.75, Math.PI * 1.5);
    return Ln(k.ring(METER.c[0], METER.c[1], METER.r - 1.4, top, P, 48), { tone: "lo" }) + Ln(t.minor, { tone: "lo" }) + Ln(t.major, { tone: "mid" }) + Ln(k.ring(METER.c[0], METER.c[1], 1.1, top, P, 12), { tone: "mid" });
  })(),
});
const needleAt = (share) => {
  const a = -Math.PI * 0.75 + share * Math.PI * 1.5;
  const [x, y] = METER.c, top = METER.z + METER.h + 0.2;
  return k.lineOnTop([x - Math.sin(a) * 1.6, y + Math.cos(a) * 1.6], [x + Math.sin(a) * (METER.r - 2.4), y - Math.cos(a) * (METER.r - 2.4)], top, P);
};
put("meter.needle", [METER.c[0], METER.c[1], METER.z + METER.h + 0.3], `<path data-part="needle" class="iso-line" data-tone="hi" data-free="start" d="${needleAt(0)}" style="stroke-width:1"/>`, [record(A.disc(vert(METER.c[0], METER.c[1], METER.z + METER.h), 0, 0.3, METER.r - 2, { name: "meter.needle", owner: "meter.body" }))], { bias: 0.3 });
// output terminals on top, rear right
const CH_OUT = { pos: [-107, -40, CH.z1], neg: [-107, -27, CH.z1] };
for (const [id, c] of Object.entries(CH_OUT)) cyl(`charger.term.${id}`, c[0], c[1], 1.3, c[2], 3, { tone: "lo" }, { steps: 14, extra: Ln(k.ring(c[0], c[1], 0.6, c[2] + 3, P, 10), { tone: "hi" }) });
// enable terminal (from the key switch) on the front-left top
const CH_EN = [-139, -16, CH.z1];
const CH_EN2 = [-135, -16, CH.z1];
for (const c of [CH_EN, CH_EN2]) cyl("charger.term.en", c[0], c[1], 1.1, c[2], 2.4, { tone: "lo" }, { steps: 12 });
// input sockets at the plate edge: banana sockets
const SOCKET = [-146, -26];
cyl("input.socket", SOCKET[0], SOCKET[1], 2.2, 0, 3.6, { tone: "lo" }, { steps: 18, extra: Ln(k.ring(SOCKET[0], SOCKET[1], 1.1, 3.6, P, 12), { tone: "hi" }) });
// current-limit resistor: a ceramic body on two clips on the plate
const RLIM = { x0: -98, x1: -86, y: -52, z: 3.4, r: 2.4 };
for (const x of [RLIM.x0 + 1.5, RLIM.x1 - 1.5]) box("rlim.clip", [x - 0.8, RLIM.y - 2.8, 0], [x + 0.8, RLIM.y + 2.8, RLIM.z - RLIM.r + 0.4], { tone: "lo" }, { r: 0.3, steps: 1 });
const RLIM_F = alongX(RLIM.x0, RLIM.y, RLIM.z);
turned("rlim.body", RLIM_F, [[0, 1.2], [0.6, RLIM.r], [RLIM.x1 - RLIM.x0 - 0.6, RLIM.r], [RLIM.x1 - RLIM.x0, 1.2]], { tone: "hi" }, {
  inner: Ln([3, 6, 9].map((s) => G.arcOf(RLIM_F, s, RLIM.r, P)).join(""), { tone: "faint" }),
});

// ---------------------------------------------------------------- block 2: capacitor bank
const BANK = { x0: -84, x1: -14, y: -30, canR: 7, canH: 24, xs: [-72, -56, -40, -24] };
const tray = box("bank.tray", [BANK.x0, BANK.y - 16, 0], [BANK.x1, BANK.y + 16, 2], { tone: "lo" }, { r: 1.2, steps: 3, extra: Dots([at([BANK.x0 + 2.5, BANK.y - 13.5, 2]), at([BANK.x1 - 2.5, BANK.y - 13.5, 2]), at([BANK.x0 + 2.5, BANK.y + 13.5, 2]), at([BANK.x1 - 2.5, BANK.y + 13.5, 2])], { size: 0.45 }) });
const CAN_TOP = 2 + BANK.canH;
const TERM_DY = 3.5;
for (const x of BANK.xs) {
  cyl("bank.can", x, BANK.y, BANK.canR, 2, BANK.canH, { tone: "hi", crease: "lo" }, {
    steps: 40,
    inner: Ln(k.sideArc(x, BANK.y, BANK.canR, CAN_TOP - 2.2, P, 32) + k.sideArc(x, BANK.y, BANK.canR, 3.6, P, 32), { tone: "faint" }),
    extra: Ln(k.ring(x, BANK.y, BANK.canR - 1.6, CAN_TOP, P, 36), { tone: "faint" }),
    attrs: ' data-can=""',
  });
  for (const dy of [-TERM_DY, TERM_DY]) cyl("bank.term", x, BANK.y + dy, 1.1, CAN_TOP, 1.6, { tone: "lo" }, { steps: 12 });
}
// clamp rails either side of the cans, on end posts
for (const dy of [-BANK.canR - 2.6, BANK.canR + 2.6]) {
  box("bank.rail", [BANK.x0 + 2, BANK.y + dy - 1.4, 10], [BANK.x1 - 2, BANK.y + dy + 1.4, 13], { tone: "mid" }, { r: 0.6, steps: 2, bevel: 0.3 });
  for (const x of [BANK.x0 + 4.5, BANK.x1 - 4.5]) cyl("bank.post", x, BANK.y + dy, 1.4, 2, 8, { tone: "lo" }, { steps: 14 });
}
// bus bars on the terminals
const BUS = { z: CAN_TOP + 1.6, h: 1.2, x0: BANK.xs[0] - 5, x1: BANK.xs[3] + 7 };
for (const [id, dy] of [["pos", -TERM_DY], ["neg", TERM_DY]]) {
  box(`bus.${id}`, [BUS.x0, BANK.y + dy - 1.1, BUS.z], [BUS.x1, BANK.y + dy + 1.1, BUS.z + BUS.h], { tone: "hi", crease: "lo" }, {
    r: 0.4, steps: 1,
    extra: Dots(BANK.xs.map((x) => at([x, BANK.y + dy, BUS.z + BUS.h])), { size: 0.4, tone: "lo" }),
  });
}
const busTop = BUS.z + BUS.h;
const busDy = (id) => (id === "pos" ? -TERM_DY : TERM_DY);
const busAt = (id, x) => [x, BANK.y + busDy(id), busTop];
// bleeder resistor in front of the bank, on two clips
const BLEED = { x0: -60, x1: -36, y: -8, z: 3.8, r: 2.8 };
for (const x of [BLEED.x0 + 2, BLEED.x1 - 2]) box("bleed.clip", [x - 0.9, BLEED.y - 3.2, 0], [x + 0.9, BLEED.y + 3.2, BLEED.z - BLEED.r + 0.5], { tone: "lo" }, { r: 0.3, steps: 1 });
const BLEED_F = alongX(BLEED.x0, BLEED.y, BLEED.z);
turned("bleed.body", BLEED_F, [[0, 1.4], [0.8, BLEED.r], [BLEED.x1 - BLEED.x0 - 0.8, BLEED.r], [BLEED.x1 - BLEED.x0, 1.4]], { tone: "hi" }, {
  inner: Ln([5, 9, 13, 17, 21].map((s) => G.arcOf(BLEED_F, s, BLEED.r, P)).join(""), { tone: "faint" }),
  attrs: ' data-part="bleeder"',
});

// ---------------------------------------------------------------- block 3: SCR on a heatsink, gate board
const HS = { x0: 0, x1: 40, y0: -46, y1: -14, z1: 5 };
box("hs.base", [HS.x0, HS.y0, 0], [HS.x1, HS.y1, HS.z1], { tone: "mid" }, { r: 0.6, steps: 2, bevel: 0.5 });
for (let i = 0; i < 8; i++) box("hs.fin", [HS.x0 + 1.5 + i * 5.1, HS.y0 + 1.5, HS.z1], [HS.x0 + 2.9 + i * 5.1, HS.y0 + 15, HS.z1 + 13], { tone: "mid", crease: "none" }, { r: 0.3, steps: 1 });
const SCR = { c: [20, -22], z: HS.z1 };
const SCRF = vert(SCR.c[0], SCR.c[1], SCR.z);
turned("scr.hex", SCRF, [[0, 5.2], [3, 5.2]], { tone: "lo" }, { steps: 6, attrs: ' data-part="scr"' });
turned("scr.body", SCRF, [[3, 4.4], [8, 4.4], [8.6, 3.2, 1], [9.2, 2.2]], { tone: "hi" }, { inner: Ln(G.arcOf(SCRF, 6, 4.4, P), { tone: "faint" }), attrs: ' data-part="scr"' });
const SCR_ANODE = [SCR.c[0], SCR.c[1], SCR.z + 9.2];
disc("scr.anode", SCRF, 9.2, 14, 1.3, { tone: "lo" }, { steps: 14 });
const SCR_GATE = [SCR.c[0] + 5.6, SCR.c[1] + 3.4, SCR.z + 3];
cyl("scr.gate.tab", SCR_GATE[0], SCR_GATE[1], 0.7, SCR.z, 3, { tone: "lo" }, { steps: 10 });
// cathode lug on the heatsink top, front-left
const SCR_K = [6, -17, HS.z1];
cyl("scr.cathode.lug", SCR_K[0], SCR_K[1], 1.6, HS.z1, 2.2, { tone: "lo" }, { steps: 14, extra: Ln(k.ring(SCR_K[0], SCR_K[1], 0.7, HS.z1 + 2.2, P, 10), { tone: "hi" }) });
// snubber: a film cap and a resistor across the SCR, on the heatsink front
box("snubber.cap", [28, -20.5, HS.z1], [36, -16, HS.z1 + 6], { tone: "hi" }, { r: 0.8, steps: 2 });
// gate trigger board on four standoffs
const GB = { x0: 2, x1: 40, y0: -4, y1: 16, z: 4, t: 1 };
for (const [x, y] of [[GB.x0 + 2.5, GB.y0 + 2.5], [GB.x1 - 2.5, GB.y0 + 2.5], [GB.x0 + 2.5, GB.y1 - 2.5], [GB.x1 - 2.5, GB.y1 - 2.5]]) cyl("gate.standoff", x, y, 1, 0, GB.z, { tone: "lo" }, { steps: 12 });
const gateTop = GB.z + GB.t;
box("gate.board", [GB.x0, GB.y0, GB.z], [GB.x1, GB.y1, gateTop], { tone: "lo" }, {
  r: 0.6, steps: 2,
  extra: Ln(k.planOutline({ x: GB.x0 + 2, y: 7.2, w: GB.x1 - GB.x0 - 4, d: 1.6, r: 0.8 }, gateTop, P, 3), { tone: "faint" }) + Dots([[GB.x0 + 2.5, GB.y0 + 2.5], [GB.x1 - 2.5, GB.y0 + 2.5], [GB.x0 + 2.5, GB.y1 - 2.5], [GB.x1 - 2.5, GB.y1 - 2.5]].map(([x, y]) => at([x, y, gateTop])), { size: 0.45 }),
});
const chip = (name, x, y, len, wid, tall = 1.3) => {
  const pins = [];
  for (let i = 0.7; i < len - 0.3; i += 1.27) pins.push(at([x + i, y - 0.3, gateTop]), at([x + i, y + wid + 0.3, gateTop]));
  box(name, [x, y, gateTop], [x + len, y + wid, gateTop + tall], { tone: "hi" }, { r: 0.15, steps: 1, extra: Dots(pins, { size: 0.22, tone: "lo" }) + Dots([at([x + 0.9, y + wid / 2, gateTop + tall])], { size: 0.35, tone: "lo" }) });
};
chip("gate.opto", 8, 9, 7.6, 3); // optocoupler straddles the isolation slot
chip("gate.driver", 20, 10.5, 5, 2.4, 1.1);
const GATE_R = alongX(26, 2, gateTop + 1.1);
turned("gate.resistor", GATE_R, [[0, 0.5], [0.4, 1.1], [4.6, 1.1], [5, 0.5]], { tone: "hi" }, { inner: Ln([1.6, 2.6, 3.6].map((s) => G.arcOf(GATE_R, s, 1.1, P)).join(""), { tone: "faint" }) });
cyl("gate.cap", 33, 12, 1.4, gateTop, 3.2, { tone: "hi" }, { steps: 16 });
put("gate.led", [36, 3, gateTop + 0.4], `<g class="cg-led" data-led="gate">${Dots([at([36, 3, gateTop + 0.4])], { size: 0.8, tone: "hi" })}</g>`, [record(A.ball([36, 3, gateTop + 0.3], 0.5, { name: "gate.led" }))], { bias: 0.4 });
// fire button: bezel on the board, cap that moves down
const BTN = { c: [10, 1.5], r: 2.6 };
cyl("gate.button.bezel", BTN.c[0], BTN.c[1], BTN.r + 1, gateTop, 1.2, { tone: "mid" }, { steps: 28 });
put("gate.button", [BTN.c[0], BTN.c[1], gateTop + 2.6], `<g data-part="button">${S(k.cylinder(BTN.c[0], BTN.c[1], BTN.r, gateTop + 1.2, 2.6, P, 28, 0.3), { tone: "hi", crease: "lo" })}${Ln(k.ring(BTN.c[0], BTN.c[1], BTN.r * 0.6, gateTop + 3.8, P, 20), { tone: "lo" })}</g>`, [record(A.cylinder(BTN.c[0], BTN.c[1], BTN.r, gateTop + 1.2, 2.6, { name: "gate.button" }))], { bias: 0.5 });
// headers: gate out (to SCR) at the back-left, input from the MCU at the right end
const GATE_OUT = [GB.x0 + 3, GB.y0 + 1.4, gateTop];
box("gate.hdr.out", [GATE_OUT[0] - 1.4, GATE_OUT[1] - 1.1, gateTop], [GATE_OUT[0] + 1.4, GATE_OUT[1] + 1.1, gateTop + 2.2], { tone: "lo" }, { r: 0.2, steps: 1 });
const GATE_IN = [GB.x1 - 2.2, 5, gateTop];
box("gate.hdr.in", [GATE_IN[0] - 1.2, GATE_IN[1] - 2.4, gateTop], [GATE_IN[0] + 1.2, GATE_IN[1] + 2.4, gateTop + 2.2], { tone: "lo" }, { r: 0.2, steps: 1, extra: Dots([-1.2, 0, 1.2].map((d) => at([GATE_IN[0], GATE_IN[1] + d, gateTop + 2.2])), { size: 0.3, tone: "hi" }) });

// ---------------------------------------------------------------- block 4: barrel, coil, flyback diode, projectile
const BF = alongX(0, BARREL.y, BARREL.z);
// saddles: two blocks the tube rests on (tangent at the tube's bottom)
const SADDLES = [[56, 64], [124, 132]];
for (const [x0, x1] of SADDLES) {
  box("saddle", [x0, BARREL.y - 8, 0], [x1, BARREL.y + 8, BARREL.z - BARREL.r], { tone: "mid" }, {
    r: 0.8, steps: 2, bevel: 0.4,
    extra: Dots([at([(x0 + x1) / 2, BARREL.y - 5.5, BARREL.z - BARREL.r]), at([(x0 + x1) / 2, BARREL.y + 5.5, BARREL.z - BARREL.r])], { size: 0.45 }),
  });
}
// the acrylic tube in bands between the parts that wrap it
const CUTS = [BARREL.x0, SADDLES[0][0], SADDLES[0][1], COIL.s0 - 2.2, COIL.s1 + 2.2, SADDLES[1][0], SADDLES[1][1], GATE_X - 2, GATE_X + 2, BARREL.x1];
for (let i = 0; i < CUTS.length - 1; i++) {
  const last = i === CUTS.length - 2;
  const wrapped = (CUTS[i] === COIL.s0 - 2.2) || (CUTS[i] === GATE_X - 2);
  if (wrapped) { record(A.ring(BF, CUTS[i], CUTS[i + 1], BARREL.bore, BARREL.r, { name: `barrel.band${i}`, owner: "barrel" })); continue; }
  ringBand(`barrel.band${i}`, BF, CUTS[i], CUTS[i + 1], BARREL.bore, BARREL.r, { tone: "hi", crease: "none" }, { rims: last ? "last" : i === 0 ? "first" : "none", owner: "barrel", cls: "cg-glass", attrs: ' data-glass=""' });
}
// the coil: two cheeks and the winding, with winding lines as inner seams
const CF = BF;
ringBand("coil.cheek0", CF, COIL.s0 - 2.2, COIL.s0, BARREL.r + 0.05, COIL.rOut + 1.4, { tone: "mid" }, { owner: "coil" });
ringBand("coil.cheek1", CF, COIL.s1, COIL.s1 + 2.2, BARREL.r + 0.05, COIL.rOut + 1.4, { tone: "mid" }, { owner: "coil" });
{
  const windings = [];
  for (let s = COIL.s0 + 1.5; s < COIL.s1 - 0.5; s += 1.5) windings.push(G.arcOf(CF, s, COIL.rOut, P));
  ringBand("coil.winding", CF, COIL.s0, COIL.s1, BARREL.r + 0.05, COIL.rOut, { tone: "hi", crease: "lo" }, { inner: Ln(windings.join(""), { tone: "faint" }), owner: "coil", attrs: ' data-part="coil"', rims: "none" });
}
// coil lugs on the bottom of the cheeks, leads run down to the terminal block
const COIL_LUG = [[COIL.s0 - 1.1, BARREL.y, BARREL.z - COIL.rOut - 1.4], [COIL.s1 + 1.1, BARREL.y, BARREL.z - COIL.rOut - 1.4]];
// terminal block on the plate in front of the coil: two bridged groups of three terminals
const TB = { x0: 78, x1: 112, y0: 44, y1: 56, z1: 6 };
box("coil.tblock", [TB.x0, TB.y0, 0], [TB.x1, TB.y1, TB.z1], { tone: "lo" }, { r: 0.6, steps: 2, bevel: 0.3, extra: Dots([at([TB.x0 + 2, TB.y1 - 1.6, TB.z1]), at([TB.x1 - 2, TB.y1 - 1.6, TB.z1])], { size: 0.45 }) });
const TERM_H = 2.6;
const TB_T = {
  a1: [83, 47.5], a2: [83, 52.5], ad: [90, 52.5],
  b1: [107, 47.5], b2: [107, 52.5], bd: [100, 52.5],
};
for (const [id, [x, y]] of Object.entries(TB_T)) cyl(`coil.term.${id}`, x, y, 1.4, TB.z1, TERM_H, { tone: "mid" }, { steps: 14, extra: Ln(k.ring(x, y, 0.65, TB.z1 + TERM_H, P, 10), { tone: "hi" }) });
box("coil.bridge.a", [81.6, 46.2, TB.z1], [91.4, 53.8, TB.z1 + 0.4], { tone: "mid", crease: "none" }, { r: 0.3, steps: 1 });
box("coil.bridge.b", [98.6, 46.2, TB.z1], [108.4, 53.8, TB.z1 + 0.4], { tone: "mid", crease: "none" }, { r: 0.3, steps: 1 });
const termTop = TB.z1 + TERM_H;
const term = (id) => [TB_T[id][0], TB_T[id][1], termTop];
// flyback diode: a stud package on a saddle between the two groups, leads to the ad and bd terminals
const DIODE_Y = 52.5;
const DF = alongX(91.6, DIODE_Y, TB.z1 + 3.5);
turned("diode.body", DF, [[0, 1.0], [0.8, 3.0], [6.0, 3.0], [6.8, 1.0]], { tone: "hi" }, { inner: Ln(G.arcOf(DF, 4.6, 3.0, P) + G.arcOf(DF, 5.2, 3.0, P), { tone: "lo" }), attrs: ' data-part="diode"' });
box("diode.saddle", [92.6, DIODE_Y - 1.6, TB.z1], [97.4, DIODE_Y + 1.6, TB.z1 + 0.5], { tone: "lo" }, { r: 0.2, steps: 1 });
const DIODE_A = [91.6, DIODE_Y, TB.z1 + 3.5];
const DIODE_K = [98.4, DIODE_Y, TB.z1 + 3.5];
// the projectile: a steel slug resting on the bore, at the breech
const SLUG = { r: 4.8, len: 12, x: BARREL.x0 + 6, z: BARREL.z - (BARREL.bore - 4.8) };
const SLUG_F = alongX(SLUG.x, BARREL.y, SLUG.z);
{
  const paths = G.solidOf([[0, SLUG.r - 1.2], [1.2, SLUG.r, 1], [SLUG.len - 1.2, SLUG.r, 1], [SLUG.len, SLUG.r - 1.2]], SLUG_F, P, { steps: 36 });
  const shape = record(A.solid(SLUG_F, [[0, SLUG.r - 1.2], [1.2, SLUG.r, 1], [SLUG.len - 1.2, SLUG.r, 1], [SLUG.len, SLUG.r - 1.2]], { name: "slug", owner: "barrel" }));
  put("slug", [SLUG.x + SLUG.len / 2, BARREL.y, SLUG.z], `<g data-part="slug">${S(paths, { tone: "hi", lit: true })}</g>`, [shape], { bias: 0 });
}

// ---------------------------------------------------------------- block 5: optical gate and MCU board
const GF = BF;
ringBand("gate.ring", GF, GATE_X - 2, GATE_X + 2, BARREL.r + 0.05, BARREL.r + 3.2, { tone: "mid" }, { owner: "gate.ring", extra: Dots(G.dotsOf(GF, GATE_X + 2, BARREL.r + 1.6, 6, P, { all: true, fade: [0.04, 0.42] }), { size: 0.35, tone: "lo" }) });
const IR_TOP = vert(GATE_X, BARREL.y, BARREL.z + BARREL.r + 3.2);
turned("gate.ir", IR_TOP, [[0, 2.2], [3.6, 2.2], [4.4, 1.4, 1], [4.8, 0.6]], { tone: "hi" });
const PD_F = G.frameOf([GATE_X, BARREL.y, BARREL.z - BARREL.r - 3.2], [0, 0, -1], PX, PY);
turned("gate.pd", PD_F, [[0, 2.2], [3.6, 2.2], [4.2, 1.6]], { tone: "hi" });
const IR_LEAD = [GATE_X, BARREL.y, BARREL.z + BARREL.r + 3.2 + 4.8];
const PD_LEAD = [GATE_X, BARREL.y, BARREL.z - BARREL.r - 3.2 - 4.2];
// MCU board behind the barrel on standoffs
const MB = { x0: 104, x1: 142, y0: -50, y1: -24, z: 4, t: 1 };
const mcuTop = MB.z + MB.t;
for (const [x, y] of [[MB.x0 + 2.5, MB.y0 + 2.5], [MB.x1 - 2.5, MB.y0 + 2.5], [MB.x0 + 2.5, MB.y1 - 2.5], [MB.x1 - 2.5, MB.y1 - 2.5]]) cyl("mcu.standoff", x, y, 1, 0, MB.z, { tone: "lo" }, { steps: 12 });
box("mcu.board", [MB.x0, MB.y0, MB.z], [MB.x1, MB.y1, mcuTop], { tone: "lo" }, {
  r: 0.6, steps: 2,
  extra: Dots([[MB.x0 + 2.5, MB.y0 + 2.5], [MB.x1 - 2.5, MB.y0 + 2.5], [MB.x0 + 2.5, MB.y1 - 2.5], [MB.x1 - 2.5, MB.y1 - 2.5]].map(([x, y]) => at([x, y, mcuTop])), { size: 0.45 }),
});
const mchip = (name, x, y, len, wid, tall = 1.3) => {
  const pins = [];
  for (let i = 0.7; i < len - 0.3; i += 1.27) pins.push(at([x + i, y - 0.3, mcuTop]), at([x + i, y + wid + 0.3, mcuTop]));
  box(name, [x, y, mcuTop], [x + len, y + wid, mcuTop + tall], { tone: "hi" }, { r: 0.15, steps: 1, extra: Dots(pins, { size: 0.22, tone: "lo" }) + Dots([at([x + 0.9, y + wid / 2, mcuTop + tall])], { size: 0.35, tone: "lo" }) });
};
mchip("mcu.chip", 112, -42, 10.2, 7.2, 1.4);
mchip("mcu.reg", 126, -44, 4.6, 2.4, 1.1);
box("mcu.crystal", [126, -36, mcuTop], [130, -34.4, mcuTop + 1.3], { tone: "hi" }, { r: 0.6, steps: 3 });
mchip("mcu.eeprom", 112, -32, 4.6, 2.4, 1.1);
cyl("mcu.reset", 120, -31, 1.1, mcuTop, 1.4, { tone: "mid" }, { steps: 12, extra: Ln(k.ring(120, -31, 0.5, mcuTop + 1.4, P, 8), { tone: "hi" }) });
box("mcu.hdr.io", [MB.x0 + 8, MB.y0 + 1.2, mcuTop], [MB.x0 + 30, MB.y0 + 3.4, mcuTop + 2.2], { tone: "lo" }, { r: 0.2, steps: 1, extra: Dots(Array.from({ length: 9 }, (_, i) => at([MB.x0 + 9.2 + i * 2.5, MB.y0 + 2.3, mcuTop + 2.2])), { size: 0.3, tone: "hi" }) });
cyl("mcu.cap", 134, -42, 1.3, mcuTop, 3, { tone: "hi" }, { steps: 16 });
put("mcu.led", [136, -31, mcuTop + 0.4], `<g class="cg-led" data-led="mcu">${Dots([at([136, -31, mcuTop + 0.4])], { size: 0.8, tone: "hi" })}</g>`, [record(A.ball([136, -31, mcuTop + 0.3], 0.5, { name: "mcu.led" }))], { bias: 0.4 });
box("mcu.usb", [MB.x0 - 2, -40, mcuTop], [MB.x0 + 4, -36, mcuTop + 2.2], { tone: "mid" }, { r: 0.3, steps: 1, extra: Ln(faceSlot([MB.x0 - 1.98, -38, mcuTop + 1.1], PY, UP, 3, 1.2, 0.5), { tone: "lo" }) });
const MCU_FIRE = [MB.x0 + 4, -27, mcuTop];
box("mcu.hdr.fire", [MCU_FIRE[0] - 1.2, MCU_FIRE[1] - 2.4, mcuTop], [MCU_FIRE[0] + 1.2, MCU_FIRE[1] + 2.4, mcuTop + 2.2], { tone: "lo" }, { r: 0.2, steps: 1, extra: Dots([-1.2, 0, 1.2].map((d) => at([MCU_FIRE[0], MCU_FIRE[1] + d, mcuTop + 2.2])), { size: 0.3, tone: "hi" }) });
const MCU_GATE = [MB.x1 - 10, -27, mcuTop];
box("mcu.hdr.gate", [MCU_GATE[0] - 1.2, MCU_GATE[1] - 2.4, mcuTop], [MCU_GATE[0] + 1.2, MCU_GATE[1] + 2.4, mcuTop + 2.2], { tone: "lo" }, { r: 0.2, steps: 1, extra: Dots([-1.2, 0, 1.2].map((d) => at([MCU_GATE[0], MCU_GATE[1] + d, mcuTop + 2.2])), { size: 0.3, tone: "hi" }) });

// ---------------------------------------------------------------- key switch (power / bleed) at the front left
const KEY = { x0: -140, x1: -126, y0: 30, y1: 44, z1: 6 };
box("key.box", [KEY.x0, KEY.y0, 0], [KEY.x1, KEY.y1, KEY.z1], { tone: "mid" }, { r: 1, steps: 3, bevel: 0.5, extra: Dots([at([KEY.x0 + 2, KEY.y0 + 2, KEY.z1]), at([KEY.x1 - 2, KEY.y1 - 2, KEY.z1])], { size: 0.45 }) });
const KEY_C = [(KEY.x0 + KEY.x1) / 2, (KEY.y0 + KEY.y1) / 2];
cyl("key.cyl", KEY_C[0], KEY_C[1], 3.2, KEY.z1, 1.2, { tone: "lo" }, { steps: 24 });
cyl("key.barrel", KEY_C[0], KEY_C[1], 2.4, KEY.z1 + 1.2, 2.8, { tone: "mid" }, { steps: 24, inner: Ln(k.sideArc(KEY_C[0], KEY_C[1], 2.4, KEY.z1 + 2.4, P, 16), { tone: "faint" }), extra: Ln(k.ring(KEY_C[0], KEY_C[1], 1.5, KEY.z1 + 4, P, 16), { tone: "lo" }) });
const KEY_BLADE = [[-1.6, -0.9], [5.6, -0.9], [5.6, 0.9], [-1.6, 0.9]];
const KEY_H = 4.2;
{
  const F = G.frameOf([KEY_C[0], KEY_C[1], KEY.z1 + 4], UP, [0, -1, 0], [1, 0, 0]);
  const shape = record(A.prism(F, KEY_BLADE, 0, KEY_H, { name: "key.blade", owner: "key.barrel" }));
  put("key.blade", [KEY_C[0], KEY_C[1], KEY.z1 + 6], `<g data-part="key">${S(G.prismOf(F, KEY_BLADE, 0, KEY_H, P), { tone: "hi", crease: "lo" })}</g>`, [shape], { bias: 0.5 });
}
const KEY_TERM = [KEY.x1 - 2.5, KEY.y0 + 2.5, KEY.z1];
cyl("key.term", KEY_TERM[0], KEY_TERM[1], 0.9, KEY.z1, 1.6, { tone: "lo" }, { steps: 10 });
const KEY_TERM2 = [KEY.x1 - 2.5, KEY.y1 - 2.5, KEY.z1];
cyl("key.term2", KEY_TERM2[0], KEY_TERM2[1], 0.9, KEY.z1, 1.6, { tone: "lo" }, { steps: 10 });

// ---------------------------------------------------------------- bench tools: discharge stick in clips, spare slugs
const STICK = { x0: -78, x1: -22, y: 55, z: 3.2, r: 1.3 };
for (const x of [STICK.x0 + 8, STICK.x0 + 26]) {
  box("stick.clip", [x - 1.2, STICK.y - 2.6, 0], [x + 1.2, STICK.y + 2.6, STICK.z - STICK.r + 0.3], { tone: "lo" }, { r: 0.3, steps: 1 });
}
const STICK_F = alongX(STICK.x0, STICK.y, STICK.z);
turned("stick.handle", STICK_F, [[0, 0.8], [0.6, STICK.r, 1], [30, STICK.r], [30, 1.0], [34, 1.0]], { tone: "mid" }, {
  inner: Ln([4, 8, 12].map((sv) => G.arcOf(STICK_F, sv, STICK.r, P)).join(""), { tone: "faint" }),
});
turned("stick.resistor", STICK_F, [[34, 1.0], [34.6, 2.0], [46, 2.0], [46.6, 1.0]], { tone: "hi" }, { inner: Ln([38, 41, 44].map((sv) => G.arcOf(STICK_F, sv, 2.0, P)).join(""), { tone: "faint" }) });
turned("stick.tip", STICK_F, [[46.6, 1.0], [52, 1.0], [54, 0.5, 1], [56, 0.15]], { tone: "hi" }, { smooth: true });
const GND = [-88, 52];
cyl("gnd.post", GND[0], GND[1], 1.6, 0, 4, { tone: "lo" }, { steps: 16, extra: Ln(k.ring(GND[0], GND[1], 0.7, 4, P, 10), { tone: "hi" }) });
const TRAY = { x0: 118, x1: 141, y0: 44, y1: 56, z1: 1.4 };
box("slug.tray", [TRAY.x0, TRAY.y0, 0], [TRAY.x1, TRAY.y1, TRAY.z1], { tone: "lo" }, { r: 0.8, steps: 2, bevel: 0.3 });
for (const dy of [TRAY.y0 + 0.5, TRAY.y1 - 1.7]) box("slug.tray.lip", [TRAY.x0, dy, TRAY.z1], [TRAY.x1, dy + 1.2, TRAY.z1 + 1.4], { tone: "mid", crease: "none" }, { r: 0.3, steps: 1 });
for (const x of [124.5, 134.5]) {
  const F = alongY(x, TRAY.y0 + 2.2, TRAY.z1 + SLUG.r);
  const profile = [[0, SLUG.r - 1.2], [1.2, SLUG.r, 1], [SLUG.len - 1.2 - 4.4, SLUG.r, 1], [SLUG.len - 4.4, SLUG.r - 1.2]];
  turned("slug.spare", F, profile, { tone: "hi" });
}

// ---------------------------------------------------------------- cables
// a cable lying in clamps on the plate has its centre at lane(r)
const lane = (r) => r * 1.5 + 0.1;
// input: the bench socket → the charger's jack, round the front of the case
cable("in.lead", [[SOCKET[0], SOCKET[1], 3.6], [SOCKET[0], SOCKET[1], 6.5], [SOCKET[0], -5.5, 7.5], [JACK[0], -5.5, JACK[2]], [JACK[0], JACK[1] + 2.4, JACK[2]]], 0.7, { tone: "mid", shells: [false, true], bend: 3 });
cable("stick.gnd", [[STICK.x0, STICK.y, STICK.z], [STICK.x0 - 4, STICK.y, STICK.z], [GND[0] + 4, GND[1], STICK.z + 1.4], [GND[0], GND[1], 4 + 3], [GND[0], GND[1], 4]], 0.5, { tone: "lo", bend: 2.6, ends: [false, true] });
// key switch → charger enable: a pair of leads in one lane down the plate, up the case front and over its top edge
const KEYLANE_Z = lane(0.45);
const keyClamp = plateClamp("clamp.key", [-120, 8], [0, 1, 0], 0.45, KEYLANE_Z, { bundle: "key" });
keyClamp.radius = 1.6;
for (const [i, [from, to]] of [[0, [KEY_TERM, CH_EN]], [1, [KEY_TERM2, CH_EN2]]]) {
  const dx = i === 0 ? -0.7 : 0.7;
  const yl = i === 0 ? -1.0 : -2.4;
  cable(`key.lead${i}`, [[from[0], from[1], KEY.z1 + 1.6], [from[0], from[1], KEY.z1 + 4.5], [-120 + dx, from[1], KEY.z1 + 4.5], [-120 + dx, from[1], KEYLANE_Z], [-120 + dx, 20, KEYLANE_Z], [-120 + dx, yl, KEYLANE_Z], [to[0], yl, KEYLANE_Z], [to[0], yl, CH.z1 + 3.4], [to[0], to[1], CH.z1 + 3.4], [to[0], to[1], CH.z1 + 2.4]], 0.45, { tone: "lo", bend: 2.4, clamps: [keyClamp], bundle: "key" });
}
// charger + → limit resistor → + bus (rear); charger − → − bus (front)
cable("chg.pos", [[CH_OUT.pos[0], CH_OUT.pos[1], CH.z1 + 3], [CH_OUT.pos[0], CH_OUT.pos[1], CH.z1 + 6], [CH_OUT.pos[0] + 6, CH_OUT.pos[1] - 6, CH.z1 + 6], [RLIM.x0 - 7, RLIM.y, 12], [RLIM.x0 - 4.5, RLIM.y, RLIM.z], [RLIM.x0, RLIM.y, RLIM.z]], 0.7, { tone: "mid", bend: 3.5 });
cable("rlim.pos", [[RLIM.x1, RLIM.y, RLIM.z], [RLIM.x1 + 4.5, RLIM.y, RLIM.z], [RLIM.x1 + 7, RLIM.y, 12], [BUS.x0 + 1.5, RLIM.y + 6, busTop + 4], [BUS.x0 + 1.5, BANK.y + busDy("pos"), busTop + 4], busAt("pos", BUS.x0 + 1.5)], 0.7, { tone: "mid", bend: 3.5 });
cable("chg.neg", [[CH_OUT.neg[0], CH_OUT.neg[1], CH.z1 + 3], [CH_OUT.neg[0], CH_OUT.neg[1], busTop + 3], [BUS.x0 + 1.5, BANK.y + busDy("neg"), busTop + 3], busAt("neg", BUS.x0 + 1.5)], 0.7, { tone: "mid", bend: 3.5 });
// bleeder leads: up from each end cap to the bus bars (the + lead crosses over the − bus with room to spare)
cable("bleed.pos", [[BLEED.x0, BLEED.y, BLEED.z], [BLEED.x0 - 4, BLEED.y, BLEED.z], [BLEED.x0 - 4, BLEED.y, busTop + 4.5], [BLEED.x0 - 4, BANK.y + busDy("pos") + 4, busTop + 4.5], [BLEED.x0 - 4, BANK.y + busDy("pos"), busTop + 4.5], busAt("pos", BLEED.x0 - 4)], 0.42, { tone: "lo", bend: 2.4 });
cable("bleed.neg", [[BLEED.x1, BLEED.y, BLEED.z], [BLEED.x1 + 4, BLEED.y, BLEED.z], [BLEED.x1 + 4, BLEED.y, busTop + 3], [BLEED.x1 + 4, BANK.y + busDy("neg") + 4, busTop + 3], [BLEED.x1 + 4, BANK.y + busDy("neg"), busTop + 3], busAt("neg", BLEED.x1 + 4)], 0.42, { tone: "lo", bend: 2.4 });
// the discharge loop in heavy cable: + bus → SCR anode; cathode lug → terminal a1; terminal b1 → − bus
cable("loop.anode", [busAt("pos", BUS.x1 - 2), [BUS.x1 - 2, BANK.y + busDy("pos"), busTop + 6], [BUS.x1 + 6, BANK.y + busDy("pos") + 2, busTop + 6], [SCR_ANODE[0] - 5, SCR.c[1], SCR_ANODE[2] + 7], [SCR_ANODE[0], SCR.c[1], SCR_ANODE[2] + 7], [SCR_ANODE[0], SCR.c[1], SCR_ANODE[2] + 4.8]], 1.1, { tone: "mid", bend: 4.5, attrs: ' data-loop=""' });
const LOOP_Z = lane(1.1);
const LANE_A = 22.0; // the coil feed, outer lane in front of the gate board
const LANE_B = 18.4; // the return, inner lane
const clampA1 = plateClamp("clamp.loopA", [-6, 4], [0, 1, 0], 1.1, LOOP_Z);
const clampA2 = plateClamp("clamp.loopA2", [60, LANE_A], [1, 0, 0], 1.1, LOOP_Z);
cable("loop.coil", [[SCR_K[0], SCR_K[1], HS.z1 + 2.2], [SCR_K[0], SCR_K[1], HS.z1 + 7], [-6, SCR_K[1], HS.z1 + 7], [-6, SCR_K[1], LOOP_Z], [-6, LANE_A, LOOP_Z], [76, LANE_A, LOOP_Z], [TB_T.a1[0], 40, LOOP_Z], [TB_T.a1[0], 40, termTop + 3.2], [TB_T.a1[0], TB_T.a1[1], termTop + 3.2], term("a1")], 1.1, { tone: "mid", bend: 4.5, clamps: [clampA1, clampA2], attrs: ' data-loop=""' });
const clampB1 = plateClamp("clamp.loopB", [20, LANE_B], [1, 0, 0], 1.1, LOOP_Z);
const clampB2 = plateClamp("clamp.loopB2", [96, LANE_B], [1, 0, 0], 1.1, LOOP_Z);
cable("loop.return", [term("b1"), [TB_T.b1[0], TB_T.b1[1], termTop + 3.2], [TB_T.b1[0], 40, termTop + 3.2], [TB_T.b1[0], 40, LOOP_Z], [116, 34, LOOP_Z], [116, LANE_B, LOOP_Z], [-2, LANE_B, LOOP_Z], [-2, BANK.y + busDy("neg") + 5, LOOP_Z], [-2, BANK.y + busDy("neg") + 5, busTop + 3], [BUS.x1 - 2, BANK.y + busDy("neg") + 2, busTop + 3], [BUS.x1 - 2, BANK.y + busDy("neg"), busTop + 3], busAt("neg", BUS.x1 - 2)], 1.1, { tone: "mid", bend: 4.5, clamps: [clampB1, clampB2], attrs: ' data-loop=""' });
// coil leads: from the lugs under the cheeks, down and forward to terminals a2 and b2
cable("coil.leadA", [COIL_LUG[0], [COIL_LUG[0][0], COIL_LUG[0][1], 10], [TB.x0 - 2, 40, 10], [TB.x0 - 2, TB_T.a2[1], 10], [TB_T.a2[0], TB_T.a2[1], 10], term("a2")], 0.8, { tone: "hi", bend: 3, ends: [true, false] });
cable("coil.leadB", [COIL_LUG[1], [COIL_LUG[1][0], COIL_LUG[1][1], 10], [TB.x1 + 2, 40, 10], [TB.x1 + 2, TB_T.b2[1], 10], [TB_T.b2[0], TB_T.b2[1], 10], term("b2")], 0.8, { tone: "hi", bend: 3, ends: [true, false] });
// diode leads to the ad and bd terminals
cable("diode.leadA", [DIODE_A, [TB_T.ad[0] + 0.3, DIODE_Y, DIODE_A[2]], [TB_T.ad[0], DIODE_Y, DIODE_A[2]], [TB_T.ad[0], DIODE_Y, termTop]], 0.45, { tone: "lo", bend: 1.4, ends: [false, true] });
cable("diode.leadK", [DIODE_K, [TB_T.bd[0] - 0.3, DIODE_Y, DIODE_K[2]], [TB_T.bd[0], DIODE_Y, DIODE_K[2]], [TB_T.bd[0], DIODE_Y, termTop]], 0.45, { tone: "lo", bend: 1.4, ends: [false, true] });
// gate pulse: board header → over the heatsink's front edge → the SCR's gate tab
cable("gate.lead", [[GATE_OUT[0], GATE_OUT[1], gateTop + 2.2], [GATE_OUT[0], GATE_OUT[1], gateTop + 5], [GATE_OUT[0], -9, gateTop + 5], [SCR_GATE[0], -9, HS.z1 + 4.4], [SCR_GATE[0], SCR_GATE[1], HS.z1 + 4.4], [SCR_GATE[0], SCR_GATE[1], SCR_GATE[2]]], 0.42, { tone: "lo", bend: 2.4, attrs: ' data-gate=""' });
// MCU fire line → gate board input: behind the barrel saddles along the plate
const SIG_Z = lane(0.45);
const sigClamp = plateClamp("clamp.sig", [74, -16], [1, 0, 0], 0.45, SIG_Z);
cable("mcu.fire", [[MCU_FIRE[0], MCU_FIRE[1], mcuTop + 2.2], [MCU_FIRE[0], MCU_FIRE[1], mcuTop + 5], [MCU_FIRE[0], -16, mcuTop + 5], [MCU_FIRE[0], -16, SIG_Z], [48, -16, SIG_Z], [48, GATE_IN[1], SIG_Z], [48, GATE_IN[1], gateTop + 3.6], [GATE_IN[0] + 3, GATE_IN[1], gateTop + 3.6], [GATE_IN[0], GATE_IN[1], gateTop + 3.6], [GATE_IN[0], GATE_IN[1], gateTop + 2.2]], 0.45, { tone: "lo", bend: 2.6, clamps: [sigClamp], shells: [true, false] });
// optical gate leads → MCU header: the IR lead over the top and down behind the barrel, the photodiode lead low
const MG = (dy, z) => [MCU_GATE[0] + dy, MCU_GATE[1] + (dy < 0 ? 1.2 : -1.2), z];
cable("gate.ir.lead", [IR_LEAD, [IR_LEAD[0], IR_LEAD[1], IR_LEAD[2] + 3], [138, 20, IR_LEAD[2] + 3], [138, 20, 10], [138, -18, 10], [MG(-0.8, 10)[0], -22, 10], MG(-0.8, 10), MG(-0.8, mcuTop + 2.2)], 0.42, { tone: "lo", bend: 2.4, ends: [true, false] });
cable("gate.pd.lead", [PD_LEAD, [PD_LEAD[0], PD_LEAD[1], PD_LEAD[2] - 2], [142, 22, PD_LEAD[2] - 2], [142, 22, 4], [142, -18, 4], [MG(0.8, 4)[0] + 1.2, -22, 9.5], MG(0.8, 10), MG(0.8, mcuTop + 2.2)], 0.42, { tone: "lo", bend: 2.4, ends: [true, false] });

// ---------------------------------------------------------------- settle, layers, page
A.settle(R, P);
R.items.sort((a, b) => a.key - b.key);
const coilKey = R.items.find((it) => it.name === "coil.winding").key;
const group = (item) => `<g class="it${item.cls ? " " + item.cls : ""}" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>`;
const backItems = R.items.filter((it) => it.key <= coilKey).map(group);
const frontItems = R.items.filter((it) => it.key > coilKey).map(group);

const LABEL_TEXT =
  "A coilgun test bench on an aluminium plate: a charger brick with a voltage knob and bank voltmeter on the left, a bank of four electrolytic capacitors under two bus bars with a bleeder resistor in front, an SCR on a finned heatsink with an isolated gate trigger board, and an acrylic barrel on two saddles carrying the coil, with a flyback diode on the coil's terminal block and a steel slug in the breech. An optical gate ring at the muzzle reports to a small microcontroller board behind the barrel.";
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, className: "cg-back", body: [...back, ...backItems] });
const fieldC = at([(COIL.s0 + COIL.s1) / 2, BARREL.y, BARREL.z]);
const fieldFallback = `<ellipse class="cg-field" data-part="field" cx="${f2(fieldC[0])}" cy="${f2(fieldC[1])}" rx="${f2(((COIL.s1 - COIL.s0) / 2 + COIL.rOut * 1.2) * KS)}" ry="${f2(COIL.rOut * 2.1 * KS)}" style="filter:blur(${f2(COIL.rOut * 0.6 * KS)}px)"/>`;
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg cg-layer cg-front" viewBox="0 0 ${W} ${H}" aria-hidden="true">${fieldFallback}${frontItems.join("")}</svg>`;

const d400 = M.derived(M.DEFAULTS);
const DATA = {
  W, H, P, V, camera: glCamera(P),
  theme: THEME,
  model: M.DEFAULTS,
  meter: METER,
  knob: KNOB,
  key: { c: KEY_C, top: KEY.z1 + 4, h: KEY_H, blade: KEY_BLADE },
  slug: { x: SLUG.x, len: SLUG.len, travel: BARREL.x1 - SLUG.x - SLUG.len + 2, barrel: { x0: BARREL.x0, x1: BARREL.x1, y: BARREL.y, z: BARREL.z, r: BARREL.r } },
  coil: { s0: COIL.s0, s1: COIL.s1, rOut: COIL.rOut, y: BARREL.y, z: BARREL.z },
  gate: { x: GATE_X },
  button: { drop: 1.2 },
  routes: { gate: CABLES.find((c) => c.name === "gate.lead").route.map((p) => at(p).map(f2)) },
};

const CSS = readFileSync(join(HERE, "coilgun.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const modelScript = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const KEYS_SCRIPT = `const MODEL = (() => {${modelScript}\nreturn { DEFAULTS, capacitance, energy, chargeTime, bleedTau, bleedTimeTo, bleedWatts, pulseHalfPeriod, peakCurrentIdeal, charge, bleed, pull, shot, sampleAt, derived, fmt };})();\n`;

const caption =
  `A single-stage coilgun bench with the control block for later stages. Energy flows left to right: a current-limited charger (1 A) fills four 820 µF electrolytics to the set point, ` +
  `${M.fmt.j(d400.energy)} at 400 V; a 10 kΩ bleeder drains the bank to 50 V in ${M.fmt.s(d400.bleedTo50)} whenever the key is off. On fire, the gate board pulses the SCR and the bank rings into the ` +
  `100 µH coil: the current peaks at ${M.fmt.a(d400.peakI)} after ${(d400.peakAt * 1e3 || 0.8).toFixed(1)} ms, the bank reaches 0 V at ${M.fmt.ms(d400.scrTime)}, and from there the flyback diode carries the coil current while it decays (τ = L/R = 2 ms). ` +
  `An SCR cannot cut that tail, so the coil keeps pulling after the slug passes its centre; the model shows the 8 g slug leaving at about ${M.fmt.mps(d400.exitV)}, ${M.fmt.pct(d400.efficiency)} of the stored energy, with an assumed force constant. ` +
  `The pulse is slowed about 200× and the bleed about 17× so you can follow them.`;

const body =
  `<style>${CSS}</style>` +
  k.plateHtml({
    fig: "Fig 1",
    title: "Coilgun circuit bench",
    hint: "↑ ↓ set voltage · space fires · K key switch",
    readout: `off · bank 0 V`,
    keys: [
      { mark: "lit", label: "The slug: pulled toward the coil's centre while current flows, held back once it is past it" },
      { mark: "raised", label: "The discharge loop: bus bars, SCR, coil and back, in heavy cable" },
      { mark: "edge", label: "Signal side: key switch, gate trigger board, optical gate and microcontroller" },
    ],
    caption,
    body: `<div class="iso-stage cg-stage" tabindex="0" role="slider" aria-label="Coilgun bench. Up and down arrows set the charger voltage, space fires, K turns the key switch, Home and End go to the limits." aria-valuemin="${M.DEFAULTS.vMin}" aria-valuemax="${M.DEFAULTS.vMax}" aria-valuenow="${M.DEFAULTS.vSet}">${backSvg}<canvas class="cg-layer cg-gl" aria-hidden="true"></canvas>${frontSvg}<span class="cg-sr" role="status" aria-live="polite" data-status></span></div>`,
  });

const page = k.pageHtml({ title: "Coilgun circuit bench", theme: THEME, body, script: kitScript() + glScript() + KEYS_SCRIPT + LIVE, width: 800 });
const name = THEME === "light" ? "coilgun-schematic-light.html" : "coilgun-schematic.html";
writeFileSync(join(HERE, name), page);
const solids = R.items.filter((it) => !it.name.includes(":")).length;
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `${solids} solids`, `${CABLES.length} cables`, `scale ${KS.toFixed(3)}`, `back ${backItems.length} front ${frontItems.length}`);

A.auditOrExit(R, P, { allow: [["barrel.*", "slug"]], crowd: CLAMPS.map((c) => [c, "*"]) });
