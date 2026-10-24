// The circuit model behind the figure. Pure: no DOM, no kit.
// Everything the page shows (needle angles, pulse length, projectile motion,
// bleed time, readout numbers) is computed here from one set of parameters.
//
// Units are SI: volts, farads, henries, ohms, kilograms, metres, seconds.

export const DEFAULTS = {
  vSet: 400, // charger set point, V
  vMin: 50, // knob floor; also the "safe to touch" line, V
  vMax: 450, // capacitor rating, V
  caps: 4, // electrolytics in parallel
  capEach: 820e-6, // F each
  chargeI: 1.0, // charger current limit, A
  L: 100e-6, // coil inductance, H
  R: 0.05, // coil + ESR + SCR + wiring, Ω
  bleedR: 10e3, // bleeder, Ω
  bleedW: 10, // bleeder rating, W
  mass: 0.008, // projectile, kg
  coilLen: 0.06, // winding length, m
  barrelLen: 0.25, // breech face to muzzle, m
  coilAt: 0.095, // coil centre from breech face, m
  slugLen: 0.03, // projectile length, m
  k: 0.00013, // force constant: F = k·i²·g(x), N/A² at the steepest point
};

export const capacitance = (p) => p.caps * p.capEach;
export const energy = (p, v) => 0.5 * capacitance(p) * v * v;
export const chargeTime = (p, v) => (capacitance(p) * v) / p.chargeI;
export const bleedTau = (p) => p.bleedR * capacitance(p);
export const bleedTimeTo = (p, v0, v1) => (v0 <= v1 ? 0 : bleedTau(p) * Math.log(v0 / v1));
export const bleedWatts = (p, v) => (v * v) / p.bleedR;
export const pulseHalfPeriod = (p) => Math.PI * Math.sqrt(p.L * capacitance(p));
export const peakCurrentIdeal = (p, v) => v * Math.sqrt(capacitance(p) / p.L);

/** Charging: a current-limited supply, dV/dt = I/C up to the set point. */
export function charge(v, p, dt) {
  const next = v + (p.chargeI / capacitance(p)) * dt;
  return Math.min(p.vSet, next);
}

/** Bleeding: V = V0·e^(−t/RC). */
export function bleed(v, p, dt) {
  return v * Math.exp(-dt / bleedTau(p));
}

/**
 * The force shape along the barrel: a solenoid pulls a slug toward its
 * centre, so the force is the derivative of a bell around the coil centre:
 * positive (forward) before the centre, negative (backward) after it.
 * x is the slug's centre from the breech face. Normalised so |g| peaks at 1.
 */
export function pull(x, p) {
  const w = (p.coilLen + p.slugLen) / 2.4;
  const u = (p.coilAt - x) / w;
  return u * Math.exp(0.5 - 0.5 * u * u);
}

/**
 * One shot from an initial bank voltage. Series RLC through the SCR until the
 * bank reaches 0 V; then the flyback diode takes the coil current and it
 * freewheels down with τ = L/R while the bank sits at 0 V. The SCR turns off
 * once its own current stops. The slug is integrated under F = k·i²·g(x).
 *
 * Returns sampled arrays over the pulse plus the derived numbers.
 */
export function shot(p, v0, { dt = 5e-6, until = 10 * p.L / p.R } = {}) {
  const C = capacitance(p);
  const t = [], i = [], vc = [], x = [], vel = [];
  let I = 0, V = v0, X = p.slugLen / 2, U = 0, time = 0;
  let phase = "scr"; // "scr" → "diode" → "off"
  let peakI = 0, peakAt = 0, diodeAt = null, offAt = null, exitAt = null, exitV = null;
  const every = Math.max(1, Math.round(1e-5 / dt));
  let n = 0;
  while (time <= until) {
    if (n % every === 0) {
      t.push(time); i.push(I); vc.push(V); x.push(X); vel.push(U);
    }
    // circuit
    if (phase === "scr") {
      const dI = (V - I * p.R) / p.L;
      I += dI * dt;
      V -= (I / C) * dt;
      if (V <= 0) { V = 0; phase = "diode"; diodeAt = time; }
    } else if (phase === "diode") {
      I -= (I * p.R / p.L) * dt;
      if (I < 0.05 * peakI) { I = 0; phase = "off"; offAt = time; }
    }
    if (I > peakI) { peakI = I; peakAt = time; }
    // slug
    const F = p.k * I * I * pull(X, p);
    U += (F / p.mass) * dt;
    X += U * dt;
    if (exitAt === null && X - p.slugLen / 2 >= p.barrelLen) { exitAt = time; exitV = U; }
    time += dt;
    n++;
    if (phase === "off" && (exitAt !== null || U <= 0)) break;
  }
  if (exitAt === null) { exitV = U; }
  const kinetic = 0.5 * p.mass * exitV * exitV;
  return {
    t, i, vc, x, v: vel,
    peakI, peakAt, diodeAt, offAt, exitAt, exitV,
    pulse: offAt ?? time,
    kinetic,
    efficiency: kinetic / energy(p, v0),
    end: time,
  };
}

/** Sample a shot's arrays at time `at` (linear interpolation). */
export function sampleAt(s, at) {
  const n = s.t.length;
  if (at <= 0) return { i: s.i[0], vc: s.vc[0], x: s.x[0], v: s.v[0] };
  if (at >= s.t[n - 1]) return { i: s.i[n - 1], vc: s.vc[n - 1], x: s.x[n - 1], v: s.v[n - 1] };
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s.t[mid] <= at) lo = mid; else hi = mid; }
  const f = (at - s.t[lo]) / (s.t[hi] - s.t[lo]);
  const mix = (a) => a[lo] + (a[hi] - a[lo]) * f;
  return { i: mix(s.i), vc: mix(s.vc), x: mix(s.x), v: mix(s.v) };
}

/** The numbers the card prints for a set point. */
export function derived(p, vSet = p.vSet) {
  const s = shot(p, vSet);
  return {
    C: capacitance(p),
    energy: energy(p, vSet),
    chargeTime: chargeTime(p, vSet),
    peakI: s.peakI,
    peakIdeal: peakCurrentIdeal(p, vSet),
    halfPeriod: pulseHalfPeriod(p),
    scrTime: s.diodeAt,
    pulse: s.pulse,
    exitV: s.exitV,
    efficiency: s.efficiency,
    bleedTau: bleedTau(p),
    bleedTo50: bleedTimeTo(p, vSet, p.vMin),
    bleedWatts: bleedWatts(p, vSet),
    hazard: vSet > p.vMin,
  };
}

export const fmt = {
  v: (v) => `${Math.round(v)} V`,
  j: (e) => (e >= 100 ? `${Math.round(e)} J` : `${e.toFixed(1)} J`),
  ms: (t) => `${(t * 1e3).toFixed(1)} ms`,
  s: (t) => (t >= 10 ? `${Math.round(t)} s` : `${t.toFixed(1)} s`),
  a: (i) => (i >= 1000 ? `${(i / 1000).toFixed(2)} kA` : `${Math.round(i)} A`),
  mps: (v) => `${Math.round(v)} m/s`,
  pct: (f) => `${(f * 100).toFixed(1)} %`,
  w: (w) => `${w.toFixed(1)} W`,
};
