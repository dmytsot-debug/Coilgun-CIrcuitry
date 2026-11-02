# Coilgun build guide · 3D

A rotatable, coloured 3D model of the build exactly as the Coilgun build guide (the team's
Claude Doc) describes it: the same parts, values and names, laid out in real millimetres.

Open `coilgun-3d.html`. It is one standalone file: Three.js 0.160 and its OrbitControls are
inlined from `vendor/` (MIT, see `vendor/THREE-LICENSE`), together with `../model.mjs`.

## What is in the scene

| Guide tab | Parts |
|---|---|
| 1 · Charging | Bench power supply (55 V, 1 A, voltage knob taped), supply leads (18 AWG red and black), blocking diode, disconnect switch (knife switch) |
| 2 · Capacitor bank | Two 10 000 µF 63 V capacitors in cradles, 4-way terminal block with + and − bus jumpers, 10 AWG jumpers, bleeder resistor (1 kΩ 10 W) standing over the block |
| 3 · Switch | Push switch (green button fires), flyback diode on its bracket across the coil terminals |
| 4 · Coil, barrel, slug | Acrylic barrel (16 × 12 mm, 30 cm) on two V-blocks with zip ties, cheeks, the 40 mm coil, coil terminal block and tails, 10 × 30 mm steel slug, breech and slug-start tape, catch box with towels and a plywood backstop |
| Tools | Multimeter clipped across the bank, discharge stick (100 Ω 10 W on a ruler) on its hook, safety glasses, spare 25 and 40 mm slugs |
| Week 6+ (toggle) | SCR on a bracket in place of the push switch, trigger board on nylon standoffs with its 9 V battery, two optical gates 50 mm apart and an Arduino Nano used as a chronograph |

## Controls

| Input | What it does |
|---|---|
| S | Supply output on or off |
| K | Disconnect switch (knife switch) closed or open |
| Space | Fire with the push switch (the trigger board when upgrades are shown) |
| D | Clip the discharge stick onto the bank, or hang it back up |
| U | Show or hide the week 6+ upgrades |
| ↑ ↓ (Shift for 1 V) | Supply set voltage, 5 to 55 V |
| P, L, R | Pause the shot, label every group, reset the view |

The page refuses the unsafe orders the guide warns about: no clipping the stick on while the
supply is connected, no closing the disconnect with the stick on, and a warning if you fire
with the disconnect still closed. Left alone it runs the guide's sequence on a loop.

## Numbers

All from `../model.mjs`, with the guide's values as defaults: 20 000 µF charged to 54.2 V
(55 V less the blocking diode) holds 29.4 J; the pulse peaks at about 490 A, the bank reaches
0 V at 2.9 ms and the flyback diode carries the tail to about 6 ms; the bleeder takes the bank
under 5 V in 48 s and the discharge stick in 4.3 s. The slug's motion uses `F = k·i²·g(x)` with
an assumed force constant chosen so the guide's slug (18 g, nose 10 mm inside the coil) leaves
at about 7 m/s, 1.7 % efficiency: the circuit numbers are exact for the parameters, the speed
is illustrative.

The pulse plays at the selected slow-down; the slug's flight after the pulse plays 20× slower;
charging, the bleeder and the discharge stick run in real time.

## Rebuilding

```sh
node build3d.mjs
```
