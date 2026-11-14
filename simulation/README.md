# Simulation

`coilgun_model.py` recomputes every hand calculation in [docs/theoretical-framework.md](../docs/theoretical-framework.md) and runs a time-domain simulation of the circuit and projectile. It needs only numpy.

```bash
python3 simulation/coilgun_model.py
```

Options: `--back-emf` couples the slug's motional EMF into the circuit, `--no-cutoff` never opens the switch, `--flyback-r 0` removes the 0.20 Ω flyback resistor (diode only).

## Model

- **Circuit:** series RLC, C_T = 0.05 F at 126 V, L = 279 µH (Wheeler), R = 0.184 Ω, with the 1 kΩ bleeder and balancing resistors as a leak across the bank. Constant L and no back-EMF unless `--back-emf` is set.
- **Coil:** 6 layers × 27 turns = 162 turns of 1.6 mm copper (1.68 mm enamelled), 45.6 mm long, 18.3 mm ID, 38.5 mm OD, 14.4 m, 0.124 Ω. This replaces the 1.02 mm, 4 × 41 coil that the framework document still derives.
- **Field:** Biot-Savart sum over all 162 loops, off-axis via elliptic integrals, averaged over the slug cross-section.
- **Force:** slug uniformly magnetised along the axis at M = min(M_s, μ_eff·B/μ₀); F = M ∫ [B_z(front face) − B_z(back face)] dA.
- **Cut-off:** the switch opens when the slug centre reaches the coil centre. The coil current then freewheels through the flyback diode (0.9 V) and decays through R_coil + R_fb (0.20 Ω).

`--volts 100` runs another charge voltage. `--sim-json model3d/sim.json` writes the traces the 3D bench plays; run `python3 model3d/build.py` afterwards.

## Results (126 V, 7/16 in slug, 1.6 mm wire, 6 × 27 turns)

| Quantity | This model | Earlier 1.02 mm coil |
|---|---|---|
| Peak current | 538 A at 3.48 ms | 372 A at 2.27 ms |
| B at centre (loop sum) | 2.04 T | 1.50 T |
| Cut-off time | 5.12 ms | 5.52 ms |
| Current at cut-off | 501 A | 312 A |
| Bank voltage at cut-off | 81.4 V | 90.6 V |
| Energy drawn | 231 J | 192 J |
| Velocity at cut-off | 21.76 m/s | 18.70 m/s |
| Flyback decay τ (diode + 0.20 Ω) | 0.863 ms | 0.470 ms |
| Switch voltage at turn-off | 182 V | 154 V |
| Flyback resistor energy / peak power | 21.4 J / 50 kW | 4.5 J / 19.5 kW |
| Exit velocity | 18.59 m/s (5.98 J) | 17.76 m/s (5.46 J) |
| Efficiency at exit (drawn / total) | 2.6 % / 1.5 % | 2.8 % / 1.4 % |
| Exit velocity with back-EMF | 18.07 m/s | 17.3 m/s |
| Diode only, no flyback resistor | 14.25 m/s | 16.7 m/s |
| No cut-off | 6.04 m/s | 7.04 m/s |

## Margins to check before charging

- The switch and the flyback diode see about 182 V at turn-off. The MBR60200W is a 200 V part: 9 % margin.
- The diode carries 501 A at cut-off against a 600 A surge rating.
- The flyback resistor absorbs 21 J per shot at 50 kW peak, up from 4.5 J. Confirm its pulse rating.
- A 0.15 Ω flyback resistor gives 157 V at turn-off and 17.9 m/s.

## Other layer counts with 1.6 mm wire (126 V, 0.20 Ω flyback)

| Layers × turns | Wire | OD | Peak | Switch at turn-off | Exit |
|---|---|---|---|---|---|
| 4 × 27 = 108 | 8.5 m | 31.7 mm | 778 A | 177 V | 20.1 m/s |
| **6 × 27 = 162** | **14.4 m** | **38.5 mm** | **538 A** | **182 V** | **18.6 m/s** |
| 8 × 27 = 216 | 21.5 m | 45.2 mm | 395 A | 172 V | 15.2 m/s |

Four layers is faster but its 778 A peak is above the 600 A switch specification.

Eddy currents and friction are not modelled. See [docs/design-review.md](../docs/design-review.md).
