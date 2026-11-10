# Cut-off timing simulation

A breadboard rehearsal of the stage-one cut-off logic (build guide, tab 5, version 2). No capacitors, no coil, no high voltage. Everything comes from the Elegoo ESP32 starter kit plus the I2C OLED.

## What it simulates

| Real gun | Breadboard |
|---|---|
| Slug | A strip of card, 30 mm long, pushed by hand |
| Barrel sensors | Two LED + photoresistor light gates, 50 mm apart |
| Gate A at coil entrance | Gate A: breaking it turns the "coil" LED on |
| Gate B at coil centre | Gate B: breaking it starts the cut-off countdown |
| IGBT gate signal | "Coil" LED on GPIO 18 (D18) |

The beam breaks when the slug's nose arrives, but the cut must happen when the slug's centre reaches the coil centre. The sketch measures speed between A and B and waits `(slug length / 2) / speed` after B breaks. It then checks itself: the midpoint of B's blocked period is when the slug's centre really crossed B, and the OLED shows the difference as `err`.

## Parts (all in the kit)

- ESP32 board, breadboard, jumper wires
- 2 photoresistors (LDRs) + 2 × 10 kΩ
- 3 LEDs (2 for the gates, 1 as the "coil") + 3 × 220 Ω
- SSD1306 128×64 I2C OLED
- Card strip cut to 30 mm (tape it to a pencil as a handle)

## Wiring

Schematic: `schematic.png`. Hole-by-hole breadboard layout: `breadboard_layout.png` (regenerate with `python3 make_breadboard_diagram.py breadboard_layout.svg`, which also checks the layout against the schematic for shorts).

```
Gate A:  3.3V ── LDR ──┬── GPIO 15 (D15)       Gate B: same, to GPIO 4 (D4)
                       └── 10k ── GND

Gate LEDs (always on):  3.3V ── 220Ω ── LED(+) ── LED(-) ── GND   (x2)

Coil LED:  GPIO 18 (D18) ── 220Ω ── LED(+) ── LED(-) ── GND

OLED:  VCC → 3.3V,  GND → GND,  SDA → GPIO 21,  SCL → GPIO 22
```

Bend each gate LED so it points straight at its LDR across a gap of 1 to 2 cm. That gap is the "barrel". The two gates sit 20 breadboard rows (50.8 mm) apart. If yours differ, edit `GATE_SPACING_MM` and `SLUG_LENGTH_MM` at the top of the sketch.

## Run it

1. Arduino IDE: install the ESP32 board package and the libraries "Adafruit SSD1306" and "Adafruit GFX". Board: ESP32 Dev Module.
2. Upload, open Serial Monitor at 115200. Keep the gates clear for the first second while it calibrates. The baselines should read above about 1000. If they're lower, aim the LEDs better or dim the room.
3. Slide the card strip through gate A then gate B at a steady speed. The coil LED turns on at A and off just after B.
4. Read the OLED: A-to-B time, speed, computed delay, total coil-on time, cut error, and the slug length measured from gate B's blocked time.

## Things to try

- **Speed sweep.** Pass slow, then fast. Does `err` stay near zero, or does it grow with speed? Photoresistors take tens of milliseconds to respond, so expect it to grow. That's the sensor-lag lesson, and the reason the real gun uses a phototransistor that responds in microseconds.
- **Measured length.** If `len` reads longer than 30 mm, the sensor is slow to recover after the slug passes. Compare it to `err`.
- **Accelerate through the gates.** The delay assumes constant speed between A and B. Speed up as you pass and watch `err` go negative: the cut comes early. A real slug accelerates the whole way, so this error is real.
- **Version 1 (timed).** Replace the B logic with a fixed delay after A and compare how much worse `err` gets when your hand speed varies.

Scale: the real slug moves about 100 times faster (5 to 20 m/s, compared with about 0.2 m/s here). The logic is identical. Only the sensors and the timescale change.
