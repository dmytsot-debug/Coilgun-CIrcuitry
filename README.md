# Coilgun Circuitry

Electronics design for a multi-stage coilgun (electromagnetic accelerator): a capacitor bank discharges into a solenoid to accelerate a projectile, with additional coils staged along the barrel.

## Status

Early design phase. Nothing is built or ordered yet. First prototype is a single-stage, capacitor-discharge design; multi-stage is the goal.

## Planned work

1. Simulate the capacitor-discharge circuit (capacitor, switch, coil, bleeder resistor) in KiCad / ngspice and compare against hand calculations.
2. Design the low-voltage control board: microcontroller, switch gate driver, and projectile-detection sensor input.
3. Review with the team before ordering parts or boards.

## Repository layout

- `kicad/` KiCad projects (schematics and PCB layouts)
- `simulation/` ngspice simulations and results
- `docs/` design notes, calculations, and write-ups
  - `docs/schematic/` interactive isometric schematic of the five circuit blocks (open `coilgun-schematic.html`); the circuit model behind it is `docs/schematic/model.mjs`

## Safety

The capacitor bank stores enough energy to cause serious injury. Do not build or charge anything at real voltage without a bleeder resistor, a defined discharge procedure, and an experienced person supervising.
