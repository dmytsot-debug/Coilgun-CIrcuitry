# Design review: open issues against the final calculations

Checked on 2026-11-09 by re-deriving every number in [theoretical-framework.md](theoretical-framework.md) with [`simulation/coilgun_model.py`](../simulation/coilgun_model.py). The hand calculations and the with-cut-off simulation reproduce to within 1 %. The items below are what the framework does not yet cover.

| # | Issue | Evidence | Suggested action |
|---|---|---|---|
| 1 | The bench supply cannot reach 126 V | Jesverty SPS-12003N tops out at 120 V. At 120 V the bank holds 360 J, not 397 J | Decide: run at 120 V and re-simulate, or buy a 126 V charger (the ratings table already calls for one) |
| 2 | Capacitors charged to 100 % of their 63 V rating | 126 V across two 63 V cans leaves zero margin; balancing resistors only equalise the static split | Charge to about 115–120 V (91–95 % of rating) until the caps' surge rating is checked on the datasheet |
| 3 | No bleeder for the series bank | The two 10 kΩ balancing resistors in series drain 0.05 F with τ = 1000 s: 126 V to 5 V takes about 54 min | Add a bank bleeder, e.g. 1 kΩ 25 W aluminium-housed across the whole bank: 16 W at 126 V, τ = 50 s, under 5 V in about 2.7 min |
| 4 | Flyback current keeps pulling after cut-off | After the switch opens, 412 A decays through the diode and coil (τ = L/R_coil ≈ 0.59 ms) while the slug is past centre. Simulation: 23.1 m/s at cut-off → 20.9 m/s at exit | Put about 0.2–0.25 Ω in series with the flyback diode: exit speed 22.4–22.5 m/s, switch sees about 170–190 V at turn-off (inside the ≥ 200 V rating, little margin) |
| 5 | "No cut-off" result does not reproduce | Framework: pulled back to about 6.1 m/s. This model: 9.6 m/s. Both agree the cut-off is essential | Re-check the original no-cut-off run's stop condition and force model |
| 6 | 126 V is above the 50 V threshold the build-guide safety rules were written around | Build guide assumes 55 V, parallel bank, about 300 J | Update safety rules: insulated tools, one-hand rule, experienced supervisor before the first 126 V charge |
| 7 | Heat estimate is an upper bound | ΔT = 9.3 °C charges all non-kinetic energy to the coil; 0.060 of 0.220 Ω of the loss is outside the coil | Fine as a safety margin; real coil rise is nearer 7 °C per shot |

## Superseded numbers still in other project documents

The build guide and the 3D bench model still describe the earlier design:

| Quantity | Earlier design | Final design |
|---|---|---|
| Bank | 2 × 0.1 F in parallel, 55 V, 302 J | 2 × 0.1 F in series, 126 V, 397 J |
| Coil | single layer, 14 cm (guide) / 40 mm (3D model), 1.6 mm wire, about 70 turns | 4 layers × 41 = 164 turns, 45.6 mm, 1.02 mm wire, 94 µH, 0.160 Ω |
| Barrel | 12 mm ID / 16 mm OD acrylic or ½" PVC | 8.4 mm bore, 10.5 mm OD, non-magnetic |
| Slug | 30 mm (guide), 10 mm rod stock | 8.0 mm × 45.6 mm, 18 g, soft iron |
| Switch | push switch, SCR upgrade | IGBT / MOSFET ≥ 200 V, ≥ 600 A, turned off by an optical gate at the coil exit |
| Peak current | about 450 A | 519 A |
| Bleeder | 200 Ω 25 W across 55 V | needs re-sizing for 126 V (item 3) |
