# Simulation

`coilgun_model.py` recomputes every hand calculation in [docs/theoretical-framework.md](../docs/theoretical-framework.md) and runs a time-domain simulation of the circuit and projectile. It needs only numpy.

```bash
python3 simulation/coilgun_model.py
```

Options: `--back-emf` couples the slug's motional EMF into the circuit, `--no-cutoff` never opens the switch, `--flyback-r 0` removes the 0.20 Ω flyback resistor (diode only).

## Model

- **Circuit:** series RLC, C_T = 0.05 F at 126 V, L = 171 µH (Wheeler), R = 0.280 Ω, with the 1 kΩ bleeder and balancing resistors as a leak across the bank. Constant L and no back-EMF unless `--back-emf` is set, as in the framework document.
- **Field:** Biot-Savart sum over all 164 loops (4 layers × 41 turns), off-axis via elliptic integrals, averaged over the slug cross-section.
- **Force:** slug uniformly magnetised along the axis at M = min(M_s, μ_eff·B/μ₀); F = M ∫ [B_z(front face) − B_z(back face)] dA.
- **Cut-off:** the switch opens when the slug centre reaches the coil centre. The coil current then freewheels through the flyback diode (0.9 V) and decays through R_coil + R_fb (0.20 Ω).

## Results (126 V, 7/16 in slug, coil wound on the 16 mm tube)

| Quantity | This model |
|---|---|
| Peak current | 405.4 A at 2.04 ms |
| B at centre (loop sum) | 1.67 T |
| B averaged over slug | 3.66 mT/A |
| Cut-off time | 5.19 ms |
| Current at cut-off | 336.1 A |
| Bank voltage at cut-off | 89.7 V |
| Energy drawn | 196 J |
| Velocity at cut-off | 19.85 m/s (6.82 J) |
| Efficiency at exit (drawn / total) | 3.2 % / 1.6 % |
| Bleeder: 126 V to 5 V | 2.69 min |
| Flyback decay τ (diode + 0.20 Ω) | 0.407 ms |
| Switch voltage at turn-off | 158 V |
| Flyback resistor energy / peak power | 4.54 J / 22.6 kW |
| Exit velocity | 18.94 m/s (6.20 J) |
| No cut-off | 7.79 m/s |

## Flyback-path variants

| Case | Velocity at cut-off | Exit velocity | Switch at turn-off |
|---|---|---|---|
| Diode only | 19.9 m/s | 17.7 m/s | 91 V |
| **Diode + 0.20 Ω (design)** | **19.9 m/s** | **18.9 m/s** | **158 V** |
| Diode + 0.20 Ω, with back-EMF | | 18.3 m/s | |
| Diode + 0.25 Ω | 19.9 m/s | 19.1 m/s | 175 V |

The drop from cut-off to exit is suck-back from the flyback current, which keeps flowing after the switch opens while the slug is past the coil centre. Eddy currents and friction are still not modelled. See [docs/design-review.md](../docs/design-review.md).
