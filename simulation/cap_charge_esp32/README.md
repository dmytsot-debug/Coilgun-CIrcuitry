# Stages 1-2 bench: supply, blocking diode, switch, bank, bleeder

Breadboard stand-in for the front end of the coilgun, read out on an ESP32 + SSD1306 OLED.

## Schematic

```
                D1 1N400x / 1N4148      SW1             R_CHG 1k
ESP32 3V3 ────────►|──────────────────o  o──────────/\/\/\────┬───────────┬──────► D15 (ADC)
               (band toward SW1)   push-button                │           │
                                  ("knife switch")         R_BLEED     C_BANK
                                                             10k     (virtual in firmware,
                                                              │       or real cap, + to node)
ESP32 GND ────────────────────────────────────────────────────┴───────────┴──────── GND rail

10k pot:   one end -> 3V3, other end -> GND, wiper -> D4   (sets virtual C, 100 uF to 10 mF)
OLED:      VCC -> 3V3, GND -> GND, SDA -> GPIO21, SCL -> GPIO22
```

| Part | Role in the real coilgun | Role on the bench |
|---|---|---|
| ESP32 3V3 pin | HV charger / supply | 3.3 V source |
| D1 | Blocking diode, stops bank back-feeding the supply | Same job |
| SW1 push-button | Knife switch | Hold = connected, release = isolated |
| R_CHG 1k | Supply's internal / current-limit resistance | Sets charge time constant, limits current |
| R_BLEED 10k | Bleeder across the bank | Same job: drains the bank when the switch opens |
| C_BANK | Capacitor bank | Virtual (pot-controlled) until a real cap is available |

## Why there's no substitute for the capacitor

Nothing else in a basic kit stores meaningful charge. A diode's junction capacitance is picofarads,
which would charge in nanoseconds. So the firmware runs the capacitor as a model:

- With no cap present, the node is a plain divider while SW1 is held, so the ESP32 can back out the
  post-diode source voltage: `Vsrc = Vnode * (R_CHG + R_BLEED) / R_BLEED`.
- Each millisecond it integrates
  `C dV/dt = I_charge - V/R_BLEED`, with `I_charge = (Vsrc - V)/R_CHG` only when SW1 is closed **and**
  `Vsrc > V` (the diode blocks reverse current).
- Release the button and you watch the bleeder drain the bank with `tau = R_BLEED * C`.

Switch, diode, bleeder and resistor values are all physically real. Only the C is simulated.

When you get a real electrolytic (100-1000 uF, rated 6.3 V or more), put it from the node to GND,
**negative leg to GND**, and set `#define USE_REAL_CAP 1`. The display then shows the measured voltage.
With 1000 uF: charge tau = (1k || 10k) * 1 mF = 0.9 s, bleed tau = 10 s.

## Expected numbers

- Vsrc after diode: about 2.6-2.8 V (3.3 V minus 0.5-0.7 V diode drop)
- Full charge with switch held: Vsrc * 10k/11k, about 2.4-2.5 V (bleeder and R_CHG divide it)
- Display shows % of that full-charge value, a bar, and a 12.8 s scrolling graph

To display the value as if it were the real bank voltage, set `DISPLAY_SCALE`, e.g. `400.0f / 2.45f`.

## Build

Arduino IDE, board "ESP32 Dev Module". Install **Adafruit SSD1306** and **Adafruit GFX** from the
Library Manager. Serial at 115200 prints CSV (`t_ms,v_node,v_cap,state,C_uF`); open the Serial Plotter
to compare with your hand calculation.

## Digital simulation

- Analog side (diode, switch, bleeder, a real cap): Falstad (falstad.com/circuit) or LTspice. Use the
  same values and compare the charge curve against the firmware model.
- Firmware + OLED: Wokwi runs ESP32 + SSD1306 + pot + button, but its analog modelling of the
  diode/resistor network is limited, so use it for the display and UI, not the electrical numbers.
