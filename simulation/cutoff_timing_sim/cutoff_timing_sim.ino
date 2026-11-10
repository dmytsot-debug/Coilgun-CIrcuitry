// Coil cut-off timing simulation (breadboard, ESP32, no high voltage)
//
// Two light gates stand in for the barrel sensors:
//   Gate A = coil entrance. Breaking it "fires" the coil (coil LED on).
//   Gate B = coil centre.   Breaking it starts the cut-off countdown.
//
// The beam breaks when the slug's NOSE reaches the gate, but the coil must
// cut when the slug's CENTRE reaches the coil centre. So after gate B breaks
// the code waits (slug length / 2) / speed, with speed measured between A and B:
//
//   delay = t_AB * (SLUG_LENGTH_MM / 2) / GATE_SPACING_MM
//
// Ground truth comes for free: the midpoint of gate B's blocked period is the
// moment the slug's centre crossed gate B. The OLED shows how far the actual
// cut landed from that moment ("cut err").
//
// Libraries: Adafruit SSD1306, Adafruit GFX (Arduino Library Manager).
// Board: ESP32 Dev Module.

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ---- Pins -------------------------------------------------------------------
const int PIN_GATE_A = 15;  // D15, LDR divider node (ADC2: fine with WiFi off)
const int PIN_GATE_B = 4;   // D4, LDR divider node (ADC2: fine with WiFi off)
const int PIN_COIL   = 18;  // D18, "coil" LED (stands in for the IGBT gate).
// OLED on the default I2C pins: SDA = GPIO 21, SCL = GPIO 22.

// ---- Geometry: measure yours and edit ---------------------------------------
const float GATE_SPACING_MM = 50.8;  // 20 breadboard rows between the two light LEDs
const float SLUG_LENGTH_MM  = 30.0;  // length of the card strip you pass through

// ---- Behaviour --------------------------------------------------------------
// Hard limit on coil-on time. The real board needs the same thing: if the
// second sensor never trips, the coil must still turn off.
const unsigned long MAX_COIL_ON_US = 3000000;  // 3 s (the sim is slow)
const float BLOCK_FRACTION = 0.60;  // blocked when reading < 60% of baseline
const float CLEAR_FRACTION = 0.80;  // clear again when reading > 80% (hysteresis)

Adafruit_SSD1306 oled(128, 64, &Wire, -1);

struct Gate {
  int pin;
  int baseline;
  int blockBelow;
  int clearAbove;
  bool blocked;
};

Gate gateA = {PIN_GATE_A, 0, 0, 0, false};
Gate gateB = {PIN_GATE_B, 0, 0, 0, false};

enum State { ARMED, COIL_ON, WAIT_CUT, WAIT_B_CLEAR };
State state = ARMED;

unsigned long tA, tB, tCutTarget, tCut, tBClear;
bool bClearedEarly;
int shot = 0;

void calibrate(Gate &g) {
  long sum = 0;
  for (int i = 0; i < 200; i++) {
    sum += analogRead(g.pin);
    delay(5);
  }
  g.baseline   = sum / 200;
  g.blockBelow = g.baseline * BLOCK_FRACTION;
  g.clearAbove = g.baseline * CLEAR_FRACTION;
  g.blocked    = false;
}

// Reads the gate; returns true if it changed state (blocked <-> clear).
bool updateGate(Gate &g) {
  int v = analogRead(g.pin);
  if (!g.blocked && v < g.blockBelow) { g.blocked = true;  return true; }
  if (g.blocked  && v > g.clearAbove) { g.blocked = false; return true; }
  return false;
}

void coil(bool on) { digitalWrite(PIN_COIL, on ? HIGH : LOW); }

void showMessage(const char *l1, const char *l2) {
  oled.clearDisplay();
  oled.setCursor(0, 0);
  oled.println(l1);
  oled.println(l2);
  oled.display();
}

void showResult() {
  float tAB_ms      = (tB - tA) / 1000.0;
  float speed_mm_s  = GATE_SPACING_MM / ((tB - tA) / 1e6);
  float delay_ms    = (tCutTarget - tB) / 1000.0;
  // Midpoint of B's blocked period = slug centre at gate B.
  float tTrue_ms    = (tB + (tBClear - tB) / 2.0 - tA) / 1000.0;
  float tCut_ms     = (tCut - tA) / 1000.0;
  float err_ms      = tCut_ms - tTrue_ms;
  float lenMeasured = speed_mm_s * ((tBClear - tB) / 1e6);

  char buf[24];
  oled.clearDisplay();
  oled.setCursor(0, 0);
  snprintf(buf, sizeof buf, "SHOT %d", shot);            oled.println(buf);
  snprintf(buf, sizeof buf, "A->B  %7.1f ms", tAB_ms);   oled.println(buf);
  snprintf(buf, sizeof buf, "speed %7.0f mm/s", speed_mm_s); oled.println(buf);
  snprintf(buf, sizeof buf, "delay %7.1f ms", delay_ms); oled.println(buf);
  snprintf(buf, sizeof buf, "on    %7.1f ms", tCut_ms);  oled.println(buf);
  snprintf(buf, sizeof buf, "err   %+7.1f ms", err_ms);  oled.println(buf);
  snprintf(buf, sizeof buf, "len   %5.0f/%.0f mm", lenMeasured, SLUG_LENGTH_MM); oled.println(buf);
  oled.display();

  Serial.printf("shot %d  A->B %.1f ms  speed %.0f mm/s  delay %.1f ms  "
                "coil on %.1f ms  cut err %+.1f ms  measured len %.0f mm%s\n",
                shot, tAB_ms, speed_mm_s, delay_ms, tCut_ms, err_ms, lenMeasured,
                bClearedEarly ? "  (B cleared before cut!)" : "");
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_COIL, OUTPUT);
  coil(false);

  Wire.begin(21, 22);
  Wire.setClock(400000);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found at 0x3C (try 0x3D)");
  }
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);

  showMessage("Calibrating...", "keep gates clear");
  calibrate(gateA);
  calibrate(gateB);
  Serial.printf("baseline A=%d B=%d (want > ~1000; aim the LEDs if lower)\n",
                gateA.baseline, gateB.baseline);
  showMessage("ARMED", "pass slug A -> B");
}

void loop() {
  unsigned long now = micros();

  switch (state) {
    case ARMED:
      updateGate(gateB);
      if (updateGate(gateA) && gateA.blocked && !gateB.blocked) {
        tA = now;
        coil(true);  // fire
        state = COIL_ON;
      }
      break;

    case COIL_ON:
      updateGate(gateA);
      if (updateGate(gateB) && gateB.blocked) {
        tB = now;
        unsigned long tAB = tB - tA;
        tCutTarget = tB + (unsigned long)(tAB * (SLUG_LENGTH_MM / 2.0) / GATE_SPACING_MM);
        bClearedEarly = false;
        state = WAIT_CUT;
      } else if (now - tA > MAX_COIL_ON_US) {
        coil(false);
        showMessage("TIMEOUT", "B never tripped");
        Serial.println("timeout: coil forced off");
        delay(1500);
        state = ARMED;
        showMessage("ARMED", "pass slug A -> B");
      }
      break;

    case WAIT_CUT:
      updateGate(gateA);
      if (updateGate(gateB) && !gateB.blocked) {
        tBClear = now;
        bClearedEarly = true;
      }
      if ((long)(now - tCutTarget) >= 0) {
        coil(false);  // cut
        tCut = now;
        state = WAIT_B_CLEAR;
      }
      break;

    case WAIT_B_CLEAR:
      updateGate(gateA);
      if (!bClearedEarly) {
        if (updateGate(gateB) && !gateB.blocked) {
          tBClear = now;
        } else {
          if (now - tA > MAX_COIL_ON_US * 2) {
            showMessage("TIMEOUT", "B never cleared");
            delay(1500);
            state = ARMED;
            showMessage("ARMED", "pass slug A -> B");
          }
          break;  // still waiting for the slug's tail to leave gate B
        }
      }
      shot++;
      showResult();
      delay(300);  // let the slug clear before re-arming
      state = ARMED;
      break;
  }
}
