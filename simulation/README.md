# Simulation

`coilgun_model.py` recomputes every hand calculation in [docs/theoretical-framework.md](../docs/theoretical-framework.md) and runs a time-domain simulation of the circuit and projectile. It needs only numpy.

```bash
python3 simulation/coilgun_model.py
```

Options: `--back-emf` couples the slug's motional EMF into the circuit, `--no-cutoff` never opens the switch, `--flyback-r 0` removes the 0.20 Ω flyback resistor (diode only).

## Model

- **Circuit:** series RLC, C_T = 0.05 F at 126 V, L = 94 µH (Wheeler), R = 0.220 Ω, with the 1 kΩ bleeder and balancing resistors as a leak across the bank. Constant L and no back-EMF unless `--back-emf` is set, as in the framework document.
- **Field:** Biot-Savart sum over all 164 loops (4 layers × 41 turns), off-axis via elliptic integrals, averaged over the slug cross-section.
- **Force:** slug uniformly magnetised along the axis at M = min(M_s, μ_eff·B/μ₀); F = M ∫ [B_z(front face) − B_z(back face)] dA.
- **Cut-off:** the switch opens when the slug centre reaches the coil centre. The coil current then freewheels through the flyback diode (0.9 V) and decays through R_coil + R_fb (0.20 Ω).

## Results against the framework document

| Quantity | Framework | This model |
|---|---|---|
| Peak current | ≈ 519 A | 518.7 A at 1.47 ms |
| B at centre (loop sum) | ≈ 2.26 T | 2.23 T |
| B averaged over slug | 3.86 mT/A | 3.87 mT/A |
| Cut-off time | ≈ 4.35 ms | 4.36 ms |
| Current at cut-off | 412 A | 412.1 A |
| Bank voltage at cut-off | 87.2 V | 87.1 V |
| Energy drawn | 207 J | 207 J |
| Velocity at cut-off | 23.1 m/s (4.78 J) | 23.14 m/s (4.82 J) |
| Efficiency (drawn / total) | 2.3 % / 1.2 % | 2.33 % / 1.21 % |
| Bleeder: 126 V to 5 V | ≈ 2.7 min | 2.69 min |
| Flyback decay τ (diode + 0.20 Ω) | 0.26 ms | 0.261 ms |
| Switch voltage at turn-off | 171 V | 170 V |
| Flyback resistor energy / peak power | ≈ 4.4 J / 34 kW | 4.38 J / 34.0 kW |
| Exit velocity | 22.4 m/s (4.50 J) | 22.35 m/s (4.50 J) |
| No cut-off | ≈ 6.1 m/s | 9.6 m/s (does not reproduce) |

## Flyback-path variants

| Case | Velocity at cut-off | Exit velocity | Switch at turn-off |
|---|---|---|---|
| Diode only | 23.1 m/s | 20.9 m/s | 88 V |
| **Diode + 0.20 Ω (design)** | **23.1 m/s** | **22.4 m/s** | **170 V** |
| Diode + 0.20 Ω, with back-EMF | 22.8 m/s | 21.9 m/s | |
| Diode + 0.25 Ω | 23.1 m/s | 22.5 m/s | 191 V |

The drop from cut-off to exit is suck-back from the flyback current, which keeps flowing after the switch opens while the slug is past the coil centre. Eddy currents and friction are still not modelled. See [docs/design-review.md](../docs/design-review.md).
