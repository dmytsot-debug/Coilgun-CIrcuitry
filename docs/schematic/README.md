# Coilgun circuit bench: interactive isometric schematic

An interactive figure of the five-block circuit as a bench you could build: charger,
capacitor bank, SCR switch with its isolated trigger board, coil with flyback diode, and
the optical gate plus microcontroller that later stages need. Energy flows left to right.

Open `coilgun-schematic.html` (dark) or `coilgun-schematic-light.html` (light) in a browser.
Both are standalone single files.

## Controls

| Input | Effect |
|---|---|
| ↑ / ↓ (Shift for 50 V) | Charger set point, 50–450 V. Drag the knob on the charger's front for the same. |
| Space / Enter, or click the trigger button | Turn the key on if it is off; otherwise fire when armed. |
| K, or click the key | Key switch: on charges the bank, off starts the bleed. |
| Home / End | Set point to 50 V / 450 V. |
| Escape | Key off. |

Left alone, the figure runs a tour: key on, charge, fire, key off, bleed, at 400, 250 and 450 V.

## What the numbers are

`model.mjs` is a pure module with no drawing in it. The page and the build both call it,
so every number in the readout and caption comes from one place. Defaults:

| Parameter | Value |
|---|---|
| Bank | 4 × 820 µF in parallel = 3.28 mF, 450 V rated |
| Charger | current limited at 1 A (charge time C·V/I, 1.3 s to 400 V) |
| Coil | 100 µH, 50 mΩ total loop resistance |
| Bleeder | 10 kΩ, 10 W (τ = RC = 33 s; 400 V → 50 V in 68 s; 16 W at 400 V) |
| Projectile | 8 g steel, 30 mm long, in a 250 mm acrylic barrel, coil centre at 95 mm |

The shot is integrated step by step: a series RLC through the SCR until the bank reaches
0 V (0.99 ms), then the flyback diode carries the coil current and it decays with τ = L/R.
Peak current at 400 V is 1.86 kA. The slug feels `F = k·i²·g(x)`, where `g` is the
derivative of a bell around the coil centre, so the force is forward before the centre and
backward after it. `k` is an assumed constant tuned to about 2.5 % efficiency at 400 V;
muzzle velocity is illustrative, the circuit numbers are not.

The pulse is shown about 200× slower than life, the bleed about 17× faster.

## Plugging in the team's values

Edit `DEFAULTS` in `model.mjs` and rebuild. Everything else follows.

## Rebuilding

```sh
node build.mjs            # dark page
node build.mjs --light    # light page
node build.mjs --audit    # geometry audit: clearances, mounts, depth order
CHROME_PATH=/path/to/chrome node scripts/lines.mjs coilgun-schematic.html   # line-end check
```

`kit/` and `scripts/` are copied from the Anatomy isometric kit so the build is self-contained.
The one audit line that remains, `barrel.band1 / slug`, is the slug seen through the acrylic
barrel, allowed on purpose.
