# Stages 1–2 Bench Test: Supply, Blocking Diode, Switch, Bleeder, Capacitor Bank

**Project:** Multi-stage coilgun
**Scope:** Charging front end only (stages 1–2). No coil, no firing stage.
**Status:** Working on the breadboard. Charge and bleed behaviour confirmed on the OLED.

## 1. Goal

Model the charging front end of the coilgun at low voltage before building it at high voltage:

> power supply → blocking diode → knife switch → capacitor bank with bleeder resistor

and show the bank voltage live on an ESP32 with an I²C OLED, both as a physical breadboard build and as a firmware model.

## 2. Hardware

| Real coilgun part | Bench stand-in | Value |
|---|---|---|
| HV supply / charger | ESP32 3V3 pin | 3.3 V |
| Blocking diode | Diode | 1N400x / 1N4148 |
| Knife switch | 4-pin tactile push-button | Hold = closed |
| Supply current limit | Charge resistor R_CHG | 1 kΩ |
| Bleeder resistor | R_BLEED | 10 kΩ |
| Capacitor bank | **Simulated in firmware** (no capacitor available) | 100 µF – 10 mF, set by pot |
| Bank voltmeter | ESP32 ADC on D15 | |
| Display | SSD1306 128×64 OLED, I²C 0x3C | D21 (SDA), D22 (SCL) |
| Bank size control | 10 kΩ potentiometer | Wiper on D4 |

Schematic: [`simulation/cap_charge_esp32/schematic.png`](../simulation/cap_charge_esp32/schematic.png)
Firmware: [`simulation/cap_charge_esp32/cap_charge_esp32.ino`](../simulation/cap_charge_esp32/cap_charge_esp32.ino)

## 3. How the capacitor is simulated

No capacitor was available, and nothing else in the kit stores useful charge (a diode's junction capacitance is in the picofarads). So the diode, switch and both resistors are real, and only the bank is modelled.

1. With no capacitor present, NODE is a plain resistor divider while the button is held. The ESP32 measures it and recovers the post-diode supply voltage:
   `V_src = V_node × (R_CHG + R_BLEED) / R_BLEED`
2. Every 1 ms it integrates
   `C · dV/dt = I_charge − V / R_BLEED`, where `I_charge = (V_src − V) / R_CHG`
   only when the switch is closed **and** `V_src > V`. That condition is the blocking diode.
3. The pot sets C on a log scale. The middle position is 1000 µF.

Expected behaviour:

| Quantity | Formula | At C = 1000 µF |
|---|---|---|
| Full-charge voltage | V_src · R_BLEED / (R_CHG + R_BLEED) | ≈ 2.45 V |
| Charge time constant | (R_CHG ∥ R_BLEED) · C | 0.9 s (full in ~4.5 s) |
| Bleed time constant | R_BLEED · C | 10 s (empty in ~50 s) |

The OLED shows the state (IDLE / CHARGING / FULL / BLEEDING), the bank voltage, % charged, C with both time constants, a charge bar and a 12.8 s scrolling graph. Serial output at 115200 baud gives CSV for plotting.

## 4. Problems hit and fixes

| Problem | Cause | Fix |
|---|---|---|
| ESP32 DevKit too wide for the breadboard; only one side of pins had free holes | 30-pin DevKit covers almost the whole breadboard | Moved every connection to the left-side pins. NODE sense moved D34 → D15, pot moved D35 → D4 (ADC2, fine because WiFi is unused). Each pin needs only one wire, and the power rails do the fan-out. |
| Confusion on how 3V3 and GND reach several parts | | One wire from 3V3 to the red rail and one from GND to the blue rail. Every part takes power from the rails. |
| OLED blank | I²C scan found the screen at 0x3C, so wiring was fine. Most likely a failed upload of the main sketch. | Re-uploaded the main sketch; the screen came up. |
| Button press did nothing | Several candidates checked: button pin pairing, resistor swap (1 kΩ vs 10 kΩ), diode direction, D15 row | Wired the button on diagonal pins and checked each item with two isolation tests (D15 straight to 3V3; bypassing the button). Circuit then worked. |

**Lessons:**
- On 4-pin tactile buttons, use diagonally opposite pins. Same-side pins may be permanently joined depending on orientation.
- An I²C scanner separates wiring faults from code faults in one step.
- Swapping R_CHG and R_BLEED drops NODE to ~0.25 V, below the 0.3 V switch-detect threshold. It looks like a dead button.

## 5. Result

- Holding the button charges the simulated bank toward ~2.45 V and shows CHARGING, then FULL.
- Releasing it shows BLEEDING, with the voltage decaying through the bleeder.
- The pot changes charge and bleed speed live, without changing the final voltage.

No quantitative logging was done in this session.

## 6. Next steps

1. **Real capacitor.** Add a 1000 µF electrolytic (≥ 6.3 V) from NODE to GND, negative leg to GND, and set `USE_REAL_CAP 1`. Log the serial CSV and compare the measured charge/bleed curves against the time constants above. This is the first real validation of the model.
2. **Scale to the real bank.** Use the model with the planned bank C and voltage to size the bleeder: it has to drain the bank to a safe voltage in a reasonable time without wasting too much charging current or exceeding its power rating (P = V²/R).
3. **Dump stage.** Add the switching element (SCR / MOSFET) and coil as stage 3, on the same bench structure.
