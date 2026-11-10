# Design review: open issues against the final calculations

Checked on 2026-11-09, updated 2026-11-10 by re-deriving every number in [theoretical-framework.md](theoretical-framework.md) with [`simulation/coilgun_model.py`](../simulation/coilgun_model.py). The hand calculations and the with-cut-off simulation reproduce to within 1 %.

| # | Issue | Evidence | Status |
|---|---|---|---|
| 1 | The bench supply cannot reach 126 V | Jesverty SPS-12003N tops out at 120 V. At 120 V the bank holds 360 J, not 397 J | **Decided 2026-11-09:** design stays at 126 V; the difference is accepted as small |
| 2 | No bleeder for the series bank | The two 10 kΩ balancing resistors in series drain 0.05 F with τ = 1000 s: 126 V to 5 V takes about 54 min | **Resolved:** 1 kΩ 25 W aluminium-housed bleeder across the bank, 15.9 W, τ = 50 s, under 5 V in 2.7 min (added to the framework doc) |
| 3 | Flyback current keeps pulling after cut-off | After the switch opens, 312 A decays through the diode and coil (τ = L/R_coil ≈ 0.85 ms) while the slug is past centre. Simulation: 18.7 m/s at cut-off → 16.7 m/s at exit | **Resolved:** 0.20 Ω in series with the flyback diode, τ = 0.47 ms, exit 17.8 m/s. Switch sees 154 V at turn-off, 23 % under its 200 V rating; a 300 V part would add margin for stray-inductance spikes |
| 4 | "No cut-off" result did not reproduce | The original framework gave about 6.1 m/s, this model 9.6 m/s (old 8 mm design) | **Closed 2026-11-10:** the framework now quotes this model (7.0 m/s for the current design). Either way the cut-off is essential |
| 5 | 126 V is above the 50 V threshold the build-guide safety rules were written around | Build guide assumes 55 V, parallel bank, about 300 J | Update safety rules: insulated tools, one-hand rule, experienced supervisor before the first 126 V charge |
| 6 | Heat estimate is an upper bound | ΔT = 5.5 °C charges all non-kinetic energy to the coil; 0.060 of 0.304 Ω of the loss is outside the coil | Fine as a safety margin; real coil rise is nearer 5 °C per shot |
| 7 | Ordered barrel tube is 12 mm ID / 16 mm OD, not 8.4 / 10.5 mm | An 8 mm slug would sit 2 mm off-centre and jam on the step into the spool's 8.4 mm bore | **Decided 2026-11-10:** keep the tube; slug becomes 7/16 in (11.1 mm) mild steel rod, 45.6 mm, 34.6 g; the tube stays in one piece and a one-piece printed coil holder with a 1 mm wall slides over it (coil ID 18.3 mm). Exit 17.8 m/s and 5.5 J, against 22.4 m/s and 4.5 J before: the team chose more energy over more speed |

## Superseded numbers still in other project documents

The build guide and the 3D bench model still describe the earlier design:

| Quantity | Earlier design | Final design |
|---|---|---|
| Bank | 2 × 0.1 F in parallel, 55 V, 302 J | 2 × 0.1 F in series, 126 V, 397 J |
| Coil | single layer, 14 cm (guide) / 40 mm (3D model), 1.6 mm wire, about 70 turns | 4 layers × 41 = 164 turns, 45.6 mm, 1.02 mm wire, ID 18.3 mm, 209 µH, 0.244 Ω |
| Barrel | 12 mm ID / 16 mm OD acrylic or ½" PVC | 12 mm ID / 16 mm OD clear acrylic, one piece, printed coil holder over it |
| Slug | 30 mm (guide), 10 mm rod stock | 11.1 mm (7/16 in) × 45.6 mm, 34.6 g, mild steel |
| Switch | push switch, SCR upgrade | IGBT / MOSFET ≥ 200 V, ≥ 600 A, turned off by an optical gate at the coil exit |
| Peak current | about 450 A | 372 A |
| Bleeder | 200 Ω 25 W across 55 V | 1 kΩ 25 W across 126 V |
| Flyback path | diode only | diode + 0.20 Ω pulse-rated wirewound |
