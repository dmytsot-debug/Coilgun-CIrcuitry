# Simulation

`coilgun_model.py` recomputes every hand calculation in [docs/theoretical-framework.md](../docs/theoretical-framework.md) and runs a time-domain simulation of the circuit and projectile. It needs only numpy.

```bash
python3 simulation/coilgun_model.py
```

Options: `--back-emf` couples the slug's motional EMF into the circuit, `--no-cutoff` never opens the switch, `--flyback-r 0.25` adds a resistor in series with the flyback diode.

## Model

- **Circuit:** series RLC, C_T = 0.05 F at 126 V, L = 94 µH (Wheeler), R = 0.220 Ω. Constant L and no back-EMF unless `--back-emf` is set, as in the framework document.
- **Field:** Biot-Savart sum over all 164 loops (4 layers × 41 turns), off-axis via elliptic integrals, averaged over the slug cross-section.
- **Force:** slug uniformly magnetised along the axis at M = min(M_s, μ_eff·B/μ₀); F = M ∫ [B_z(front face) − B_z(back face)] dA.
- **Cut-off:** the switch opens when the slug centre reaches the coil centre. The coil current then freewheels through the flyback diode (0.9 V) and decays through R_coil.

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
| No cut-off | ≈ 6.1 m/s | 9.6 m/s (does not reproduce) |

## Beyond the document

| Case | Velocity at cut-off | Exit velocity |
|---|---|---|
| Framework model (no back-EMF, diode only) | 23.1 m/s | 20.9 m/s |
| With back-EMF | 22.8 m/s | 20.0 m/s |
| Diode + 0.10 Ω (switch sees ≈ 129 V) | 23.1 m/s | 21.9 m/s |
| Diode + 0.20 Ω (≈ 170 V) | 23.1 m/s | 22.4 m/s |
| Diode + 0.25 Ω (≈ 191 V) | 23.1 m/s | 22.5 m/s |

The drop from cut-off to exit is suck-back from the flyback current, which keeps flowing for about 0.6 ms after the switch opens while the slug is past the coil centre. Eddy currents and friction are still not modelled. See [docs/design-review.md](../docs/design-review.md).
