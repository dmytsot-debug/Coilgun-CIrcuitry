// Builds coilgun-3d.html: one standalone page with Three.js, OrbitControls, the model, the scene and the UI inlined.
// node build3d.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(HERE, f), "utf8");

// three.module.min.js ends with `export{A as B,...}`: turn the export list into a THREE object.
function threeAsGlobal(src) {
  const at = src.lastIndexOf("export{");
  if (at < 0) throw new Error("no export list in three.module.min.js");
  const list = src.slice(at + 7, src.lastIndexOf("}"));
  const entries = list.split(",").map((e) => e.trim()).filter(Boolean).map((e) => {
    const m = e.match(/^(\S+)\s+as\s+(\S+)$/);
    return m ? `${m[2]}:${m[1]}` : `${e}:${e}`;
  });
  return `const THREE=(()=>{${src.slice(0, at)}\nreturn {${entries.join(",")}};})();`;
}
function orbitAsGlobal(src) {
  const imp = src.match(/import\s*\{([\s\S]*?)\}\s*from\s*'three';/);
  if (!imp) throw new Error("OrbitControls import not found");
  const names = imp[1].split(",").map((s) => s.trim()).filter(Boolean);
  return src.replace(imp[0], `const {${names.join(",")}} = THREE;`).replace(/export\s*\{\s*OrbitControls\s*\};?/, "");
}

const three = threeAsGlobal(read("vendor/three.module.min.js"));
const orbit = orbitAsGlobal(read("vendor/OrbitControls.js"));
const model = read("../model.mjs").replace(/^export /gm, "");
const MODEL = `const MODEL = (() => {${model}\nreturn { DEFAULTS, capacitance, energy, chargeTime, bleedTau, bleedTimeTo, bleedWatts, pulseHalfPeriod, peakCurrentIdeal, charge, bleed, pull, shot, sampleAt, derived, fmt };})();`;
const scene = read("scene.js");
const ui = read("ui.js");
const css = read("style.css");

const body = `
<div class="cg3-app">
  <div class="cg3-stage" tabindex="0" role="slider" aria-label="Coilgun bench, 3D. Drag to orbit, scroll to zoom. Up and down arrows set the voltage, space fires, K turns the key, P pauses, L shows labels, R resets the view." aria-valuemin="50" aria-valuemax="450" aria-valuenow="400">
    <canvas class="cg3-canvas"></canvas>
    <div class="cg3-tags" aria-hidden="true"></div>
    <div class="cg3-tip" hidden></div>
    <span class="cg3-corner tl">Fig 2</span>
    <span class="cg3-corner tr">Coilgun circuit bench · 3D</span>
    <span class="cg3-corner bl">Drag to orbit · hover for labels · ↑ ↓ voltage · space fires · K key</span>
    <span class="cg3-corner br" data-readout>off · bank 0 V</span>
    <span class="cg3-sr" role="status" aria-live="polite" data-status></span>
  </div>
  <aside class="cg3-panel">
    <div class="cg3-panel-head"><h1>Controls</h1><button id="toggle-panel" title="Collapse the panel" aria-label="Collapse the panel">☰</button></div>
    <details open><summary>Playback</summary>
      <div class="cg3-sec">
        <div class="cg3-buttons"><button data-action="key">Key on</button><button data-action="fire" class="primary">Fire</button><button data-action="pause">Pause</button><button data-action="reset">Reset</button></div>
        <label class="cg3-field"><span>Shot speed</span><select id="speed"></select></label>
        <label class="cg3-field" style="grid-template-columns:1fr"><span>Scrub the shot (pauses it)</span><input id="scrub" class="cg3-scrub" type="range" min="0" max="1000" value="0"></label>
        <canvas class="cg3-scope" aria-label="Oscilloscope: coil current, bank voltage and slug position over the shot"></canvas>
        <p class="cg3-keys"><kbd>space</kbd> fire · <kbd>K</kbd> key · <kbd>P</kbd> pause · <kbd>↑</kbd><kbd>↓</kbd> voltage · <kbd>L</kbd> labels · <kbd>R</kbd> reset view</p>
      </div>
    </details>
    <div data-controls></div>
    <details open><summary>View</summary>
      <div class="cg3-sec">
        <div class="cg3-views"><button data-view="overview">Overview</button><button data-view="charger">Charger</button><button data-view="bank">Bank</button><button data-view="switch">Switch</button><button data-view="coil">Coil</button><button data-view="muzzle">Muzzle</button><button data-view="top">Top</button><button data-action="resetview">Reset</button></div>
        <label class="cg3-check"><input id="follow" type="checkbox"> Follow the slug during a shot</label>
        <label class="cg3-check"><input id="autorotate" type="checkbox"> Auto-rotate</label>
        <label class="cg3-check"><input id="labels" type="checkbox"> Label every block</label>
        <label class="cg3-check"><input id="shadows" type="checkbox" checked> Shadows</label>
        <label class="cg3-check"><input id="theme" type="checkbox"> Light theme</label>
        <label class="cg3-field" style="grid-template-columns:1fr"><span>Exploded view</span><input id="explode" type="range" min="0" max="100" value="0" class="cg3-scrub"></label>
      </div>
    </details>
  </aside>
</div>`;

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Coilgun circuit bench · 3D</title><style>${css}</style></head><body>${body}
<script type="module">
${three}
${orbit}
${MODEL}
${scene}
${ui}
</script></body></html>`;
writeFileSync(join(HERE, "coilgun-3d.html"), page);
console.log("wrote coilgun-3d.html", `${(page.length / 1024).toFixed(0)} KB`);
