# Coilgun Circuitry

Electronics design for a coilgun (electromagnetic accelerator): a capacitor bank discharges into a multilayer coil to pull a soft-iron slug down a non-magnetic barrel. The first prototype is single stage; multi-stage is the goal.

## Status

Calculations for the single-stage design are final. The source of truth is the team's Formulas_and_Theoretical_Framework doc on the shared drive; [docs/theoretical-framework.md](docs/theoretical-framework.md) mirrors it and a simulation script reproduces every number. Hardware is not built yet; open design issues are listed in the [design review](docs/design-review.md).

## Design at a glance

| | |
|---|---|
| Bank | 2 × 0.1 F, 63 V electrolytics in series: 0.05 F at 126 V, 397 J, 10 kΩ 1 W balancing resistor across each |
| Bleeder | 1 kΩ 25 W aluminium-housed across the bank: 15.9 W, 126 V to under 5 V in 2.7 min |
| Coil | 4 layers × 41 turns = 164 turns of 1.02 mm (18 AWG) enamelled copper, 45.6 mm long, 10.5 mm ID, 19.3 mm OD, 7.67 m of wire |
| Coil electrical | L = 94 µH (Wheeler), R_coil = 0.160 Ω, R_total = 0.220 Ω (overdamped) |
| Projectile | soft iron / low-carbon steel, 8.0 mm × 45.6 mm, 18 g |
| Barrel | non-magnetic, 8.4 mm bore, 10.5 mm OD |
| Switch | IGBT / MOSFET, ≥ 200 V, ≥ 600 A pulse, turned off by an optical gate at the coil exit |
| Flyback path | diode (≥ 200 V, ≥ 450 A pulse, fast recovery) in series with 0.20 Ω pulse-rated wirewound, across the coil; switch sees 171 V at turn-off |
| Peak current | ≈ 519 A at 1.47 ms |
| Field at coil centre | ≈ 2.26 T |
| Cut-off | ≈ 4.35 ms, 412 A, bank left at 87.2 V |
| Muzzle velocity | 23.1 m/s at cut-off, 22.4 m/s at coil exit simulated; 19–21 m/s expected after eddy, friction and back-EMF losses (target 20 m/s) |
| Efficiency | 2.2 % of energy drawn, 1.1 % of energy stored (at exit) |
| Coil heating | ≤ 9.1 °C per shot |

![System diagram](docs/figures/system-diagram.png)

## Repository layout

- `docs/theoretical-framework.md` all formulas and values, with figures
- `docs/design-review.md` open issues and numbers that changed from the earlier design
- `docs/figures/` system diagram and coil winding diagram
- `simulation/coilgun_model.py` hand calculations + circuit/projectile simulation (numpy only); see `simulation/README.md`
- `kicad/` KiCad projects (schematics and PCB layouts), not started

## Next steps

1. Simulate the discharge loop in KiCad / ngspice and compare against `coilgun_model.py`.
2. Design the low-voltage control board: microcontroller, IGBT gate driver, optical gate input.
3. Review with the team before ordering parts or boards.

## Safety

126 V is above the roughly 50 V DC level where skin stops limiting current to a safe level, and the bank stores about 400 J. Do not charge anything without a bleeder across the bank, a discharge stick, a meter reading under 5 V before hands go near it, and an experienced person supervising.
