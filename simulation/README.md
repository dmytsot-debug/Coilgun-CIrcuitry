# Simulation

`coilgun_model.py` recomputes every hand calculation in [docs/theoretical-framework.md](../docs/theoretical-framework.md) and runs a time-domain simulation of the circuit and projectile. It needs only numpy.

```bash
python3 simulation/coilgun_model.py
```

Options: `--back-emf` couples the slug's motional EMF into the circuit, `--no-cutoff` never opens the switch, `--flyback-r 0` removes the 0.20 Ω flyback resistor (diode only).

## Model

- **Circuit:** series RLC, C_T = 0.05 F at 126 V, L = 155 µH (Wheeler), R = 0.269 Ω, with the 1 kΩ bleeder and balancing resistors as a leak across the bank. Constant L and no back-EMF unless `--back-emf` is set, as in the framework document.
- **Field:** Biot-Savart sum over all 164 loops (4 layers × 41 turns), off-axis via elliptic integrals, averaged over the slug cross-section.
- **Force:** slug uniformly magnetised along the axis at M = min(M_s, μ_eff·B/μ₀); F = M ∫ [B_z(front face) − B_z(back face)] dA.
- **Cut-off:** the switch opens when the slug centre reaches the coil centre. The coil current then freewheels through the flyback diode (0.9 V) and decays through R_coil + R_fb (0.20 Ω).

## Results (126 V, 7/16 in slug, 1.5 mm printed core)

| Quantity | This model |
|---|---|
| Peak current | 422.2 A at 1.94 ms |
| B at centre (loop sum) | 1.76 T |
| B averaged over slug | 3.71 mT/A |
| Cut-off time | 5.05 ms |
| Current at cut-off | 347.6 A |
| Bank voltage at cut-off | 89.2 V |
| Energy drawn | 198 J |
| Velocity at cut-off | 20.40 m/s (7.20 J) |
| Efficiency at exit (drawn / total) | 3.3 % / 1.7 % |
| Bleeder: 126 V to 5 V | 2.69 min |
| Flyback decay τ (diode + 0.20 Ω) | 0.380 ms |
| Switch voltage at turn-off | 160 V |
| Flyback resistor energy / peak power | 4.53 J / 24.2 kW |
| Exit velocity | 19.50 m/s (6.58 J) |
| No cut-off | 8.15 m/s |

## Flyback-path variants

| Case | Velocity at cut-off | Exit velocity | Switch at turn-off |
|---|---|---|---|
| Diode only | 20.4 m/s | 18.2 m/s | 90 V |
| **Diode + 0.20 Ω (design)** | **20.4 m/s** | **19.5 m/s** | **160 V** |
| Diode + 0.20 Ω, with back-EMF | | 18.9 m/s | |
| Diode + 0.25 Ω | 20.4 m/s | 19.6 m/s | 177 V |

The drop from cut-off to exit is suck-back from the flyback current, which keeps flowing after the switch opens while the slug is past the coil centre. Eddy currents and friction are still not modelled. See [docs/design-review.md](../docs/design-review.md).
