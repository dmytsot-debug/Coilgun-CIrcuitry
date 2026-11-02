/*
 * Coilgun stages 1-2 test bench: supply -> blocking diode -> switch -> bank + bleeder
 * ESP32 + SSD1306 128x64 I2C OLED
 *
 * Board circuit (see README.md):
 *   3V3 -->|D1|-- SW1 (push-button) -- R_CHARGE 1k --+-- NODE --> GPIO34
 *                                                    |
 *                                                 R_BLEED 10k  [C_BANK optional]
 *                                                    |
 *                                                   GND
 *   10k pot: ends to 3V3/GND, wiper -> GPIO35  (sets virtual capacitance)
 *   OLED: SDA -> GPIO21, SCL -> GPIO22, VCC -> 3V3, GND -> GND
 *
 * USE_REAL_CAP 0: no capacitor on the board. The ESP32 measures the real
 *   diode/switch/resistor network and integrates a virtual capacitor in firmware.
 * USE_REAL_CAP 1: an electrolytic cap sits from NODE to GND. The ESP32 just
 *   measures its voltage.
 *
 * Libraries: Adafruit SSD1306, Adafruit GFX (Arduino Library Manager)
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>

// ------------------------- configuration -------------------------
#define USE_REAL_CAP 0

const float R_CHARGE = 1000.0f;    // ohms, must match the resistor on the board
const float R_BLEED  = 10000.0f;   // ohms, must match the resistor on the board

const float C_MIN = 100e-6f;       // pot fully CCW (farads)
const float C_MAX = 10000e-6f;     // pot fully CW  (farads)

// Multiplies every displayed voltage. 1.0 shows real volts. To show the
// value as if it were the full-size bank, set e.g. 400.0f / 2.45f.
const float DISPLAY_SCALE = 1.0f;

const float SWITCH_CLOSED_V = 0.30f;  // node above this = switch closed (virtual mode)

const int NODE_PIN = 34;   // ADC1, input-only
const int POT_PIN  = 35;   // ADC1, input-only
const int SDA_PIN  = 21;
const int SCL_PIN  = 22;

const uint32_t PLOT_INTERVAL_MS = 100;  // one graph column per 100 ms -> 12.8 s window
// ----------------------------------------------------------------

#define SCREEN_W 128
#define SCREEN_H 64
Adafruit_SSD1306 oled(SCREEN_W, SCREEN_H, &Wire, -1);

const int PLOT_TOP = 46;
const int PLOT_H   = SCREEN_H - PLOT_TOP;
float history[SCREEN_W];
int   histHead = 0;

float vCap = 0.0f;          // capacitor voltage (real volts)
float vSrc = 2.7f;          // supply voltage after the diode, updated while switch is closed
float capF = 1000e-6f;      // current capacitance
uint32_t lastMicros = 0;
uint32_t lastPlot = 0;
uint32_t lastPrint = 0;

enum State { IDLE, CHARGING, BLEEDING, FULL };
State state = IDLE;

float readVolts(int pin, int samples = 16) {
  uint32_t sum = 0;
  for (int i = 0; i < samples; i++) sum += analogReadMilliVolts(pin);
  return (sum / (float)samples) / 1000.0f;
}

const char* stateName(State s) {
  switch (s) {
    case CHARGING: return "CHARGING";
    case BLEEDING: return "BLEEDING";
    case FULL:     return "FULL";
    default:       return "IDLE";
  }
}

// Steady-state bank voltage with switch closed: the bleeder and R_CHARGE form a divider.
float fullVoltage() {
  return vSrc * R_BLEED / (R_CHARGE + R_BLEED);
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);   // ~0-3.1 V input range

  Wire.begin(SDA_PIN, SCL_PIN);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {   // try 0x3D if blank
    Serial.println("SSD1306 not found. Check wiring / address.");
    while (true) delay(1000);
  }
  oled.setTextColor(SSD1306_WHITE);
  oled.clearDisplay();
  oled.display();

  for (int i = 0; i < SCREEN_W; i++) history[i] = 0.0f;
  lastMicros = micros();
  Serial.println("t_ms,v_node,v_cap,state,C_uF");
}

void loop() {
  uint32_t now = micros();
  float dt = (now - lastMicros) * 1e-6f;
  lastMicros = now;

  float vNode = readVolts(NODE_PIN);
  float pot   = readVolts(POT_PIN) / 3.1f;
  pot = constrain(pot, 0.0f, 1.0f);
  capF = C_MIN * powf(C_MAX / C_MIN, pot);   // log taper so the whole range is usable

#if USE_REAL_CAP
  // The node IS the capacitor. Infer state from the slope.
  static float vPrev = 0.0f;
  float slope = (vNode - vPrev) / max(dt, 1e-4f);
  vPrev = vNode;
  vCap = vNode;
  if (vCap < 0.05f)        state = IDLE;
  else if (slope > 0.02f)  state = CHARGING;
  else if (slope < -0.02f) state = BLEEDING;
  else                     state = FULL;
#else
  // No capacitor on the board, so the node is a pure resistor divider while
  // the switch is held. Back out the post-diode source voltage from it.
  bool closed = vNode > SWITCH_CLOSED_V;
  if (closed) vSrc = vNode * (R_CHARGE + R_BLEED) / R_BLEED;

  // Integrate the virtual capacitor in 1 ms substeps (smallest tau ~ 90 ms).
  float remaining = dt;
  while (remaining > 0.0f) {
    float h = min(remaining, 0.001f);
    // Blocking diode: charge current flows only forward (source above cap).
    float iCharge = (closed && vSrc > vCap) ? (vSrc - vCap) / R_CHARGE : 0.0f;
    float iBleed  = vCap / R_BLEED;   // bleeder is always across the bank
    vCap += (iCharge - iBleed) / capF * h;
    if (vCap < 0.0f) vCap = 0.0f;
    remaining -= h;
  }

  float vFull = fullVoltage();
  if (closed)              state = (vCap > 0.99f * vFull) ? FULL : CHARGING;
  else if (vCap > 0.02f)   state = BLEEDING;
  else                     state = IDLE;
#endif

  uint32_t ms = millis();
  if (ms - lastPlot >= PLOT_INTERVAL_MS) {
    lastPlot = ms;
    history[histHead] = vCap;
    histHead = (histHead + 1) % SCREEN_W;
  }

  if (ms - lastPrint >= 50) {
    lastPrint = ms;
    Serial.printf("%lu,%.3f,%.3f,%s,%.0f\n", ms, vNode, vCap, stateName(state), capF * 1e6f);
    drawScreen();
  }
}

void drawScreen() {
  float vFull = fullVoltage();
  float pct = vFull > 0.01f ? 100.0f * vCap / vFull : 0.0f;
  pct = constrain(pct, 0.0f, 100.0f);

  oled.clearDisplay();

  // Line 1: state + percent
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print(stateName(state));
  oled.setCursor(98, 0);
  oled.printf("%3.0f%%", pct);

  // Line 2: big voltage
  oled.setTextSize(2);
  oled.setCursor(0, 11);
  float shown = vCap * DISPLAY_SCALE;
  if (shown >= 100.0f) oled.printf("%.0f V", shown);
  else                 oled.printf("%.2f V", shown);

  // Line 3: capacitance + time constants
  oled.setTextSize(1);
  oled.setCursor(0, 29);
#if USE_REAL_CAP
  oled.print("REAL CAP");
#else
  float tauChg = (R_CHARGE * R_BLEED / (R_CHARGE + R_BLEED)) * capF;
  float tauBld = R_BLEED * capF;
  oled.printf("%.0fuF t%.1fs b%.0fs", capF * 1e6f, tauChg, tauBld);
#endif

  // Charge bar
  oled.drawRect(0, 39, SCREEN_W, 5, SSD1306_WHITE);
  oled.fillRect(1, 40, (int)((SCREEN_W - 2) * pct / 100.0f), 3, SSD1306_WHITE);

  // Scrolling plot, scaled to the full-charge voltage
  float yMax = max(vFull, 0.1f) * 1.05f;
  for (int x = 0; x < SCREEN_W; x++) {
    float v = history[(histHead + x) % SCREEN_W];
    int y = SCREEN_H - 1 - (int)((PLOT_H - 1) * constrain(v / yMax, 0.0f, 1.0f));
    oled.drawPixel(x, y, SSD1306_WHITE);
  }

  oled.display();
}
