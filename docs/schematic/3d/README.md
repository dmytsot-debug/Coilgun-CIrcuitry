# Coilgun circuit bench · 3D

A rotatable, coloured 3D model of the five-block circuit on a bench, with hover labels on
every component, a control panel for the circuit and projectile parameters, slow-motion
playback of the shot with an oscilloscope, camera presets and an exploded view.

Open `coilgun-3d.html`. It is one standalone file: Three.js 0.160 and its OrbitControls are
inlined from `vendor/` (MIT, see `vendor/THREE-LICENSE`), together with `../model.mjs`.

## Controls

| Where | What |
|---|---|
| Drag / scroll / right-drag | Orbit, zoom, pan |
| Hover | Label with the part's value and role; values follow the sliders |
| Playback | Key on/off, Fire, Pause, Reset; shot speed (×50, ×200, ×1000 slower, real time); scrub slider pauses the shot and moves through it; oscilloscope of coil current (orange), bank voltage (blue) and slug position (green) |
| Circuit | Bank voltage, capacitor count and value, coil inductance, loop resistance, charger current limit, bleeder resistance. Readout: C, energy, charge time, peak current, π√LC, time to 0 V, pulse to 5 %, bleed τ, bleed to 50 V, bleeder dissipation (orange when over its rating) |
| Projectile and coil | Slug mass and length, coil length and position, force constant k. Readout: exit velocity, kinetic energy, efficiency, and a suck-back warning when the slug is still inside the coil at the end of the pulse |
| View | Presets (overview, charger, bank, switch, coil, muzzle, top), follow the slug, auto-rotate, label every block, shadows, light theme, exploded view |
| Keys | ↑ ↓ voltage (Shift ×5), space fire, K key, P pause, L labels, R reset view, Esc key off |

Clicking the fire button or the key in the scene does the same as the panel. Dragging the
voltage knob on the charger sets the voltage.

## What moves during a shot

The SCR body glows while it conducts, the heavy loop cables glow with the current, and the
flyback diode glows once the bank reaches 0 V and the coil current freewheels through it.
The coil's field is drawn as nested shells scaled by the current squared. A green arrow on
the slug shows the forward pull; it turns red once the slug is past the coil's centre and
the tail current pulls it back. The slug stops in the catch box.

The pulse is shown slowed by the selected factor; the bleed runs about 17× faster than life.

## Numbers

All from `../model.mjs`, the same model the isometric figure uses. The circuit numbers are
exact for the parameters; the slug's motion uses `F = k·i²·g(x)` with an assumed force
constant, so its velocity is illustrative.

## Rebuilding

```sh
node build3d.mjs
```
