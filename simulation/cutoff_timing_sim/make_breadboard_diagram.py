#!/usr/bin/env python3
"""Breadboard layout for the cut-off timing simulation.

One data model (parts + wires, addressed by breadboard hole) feeds two things:
  1. a netlist check against the schematic (no shorts, every net as designed), and
  2. the SVG drawing (breadboard_layout.svg).

Board: full-size 830-point breadboard, 63 rows, columns a-e | channel | f-j,
power rails on both long edges. ESP32 (30-pin) straddles the channel with its
left pins in column c and right pins in column j, USB end at the top.
The only free hole next to each left pin is column a.
"""
import sys

# ----------------------------------------------------------------------------
# Data model
# ----------------------------------------------------------------------------
ESP_PINS = ["3V3", "GND", "D15", "D2", "D4", "RX2", "TX2", "D5", "D18",
            "D19", "D21", "RX0", "TX0", "D22", "D23"]
ESP_FIRST_ROW = 3
ESP_ROW = {p: ESP_FIRST_ROW + i for i, p in enumerate(ESP_PINS)}
ESP_LAST_ROW = ESP_FIRST_ROW + len(ESP_PINS) - 1          # 17
ESP_BODY_LAST_ROW = 21                                    # antenna end overhang

# Component legs: name -> list of (terminal, row, col)
PARTS = {
    # coil LED chain (left half): D18 -> 220R -> LED -> GND
    "R_coil":  {"kind": "R220", "legs": [("RC.1", 27, "b"), ("RC.2", 30, "b")]},
    "LED_coil": {"kind": "LEDG", "legs": [("LEDC.A", 30, "c"), ("LEDC.K", 31, "c")]},
    # gate A, LDR side (left half): 3V3 -> LDR -> node -> 10k -> GND
    "R_A":     {"kind": "R10k", "legs": [("RA.1", 37, "b"), ("RA.2", 40, "b")]},
    "LDR_A":   {"kind": "LDR", "legs": [("LDRA.1", 40, "d"), ("LDRA.2", 42, "d")]},
    # gate A, light side (right half): 3V3 -> 220R -> LED -> GND
    "R_LA":    {"kind": "R220", "legs": [("RLA.1", 37, "h"), ("RLA.2", 40, "h")]},
    "LED_A":   {"kind": "LED", "legs": [("LEDA.A", 40, "g"), ("LEDA.K", 41, "g")]},
    # gate B = gate A shifted 20 rows (50.8 mm)
    "R_B":     {"kind": "R10k", "legs": [("RB.1", 57, "b"), ("RB.2", 60, "b")]},
    "LDR_B":   {"kind": "LDR", "legs": [("LDRB.1", 60, "d"), ("LDRB.2", 62, "d")]},
    "R_LB":    {"kind": "R220", "legs": [("RLB.1", 57, "h"), ("RLB.2", 60, "h")]},
    "LED_B":   {"kind": "LED", "legs": [("LEDB.A", 60, "g"), ("LEDB.K", 61, "g")]},
}

# Wires: (id, colour key, endpoint A, endpoint B)
#   ('h', row, col)  breadboard hole
#   ('r', rail, row) power-rail hole  (rails: 'L+', 'L-', 'R+', 'R-')
#   ('o', name)      off-board pin (OLED)
H = lambda r, c: ("h", r, c)
RL = lambda rail, r: ("r", rail, r)
WIRES = [
    ("ESP 3V3 to + rail",         "3v3",    H(ESP_ROW["3V3"], "a"), RL("L+", 3)),
    ("ESP GND to - rail",         "gnd",    H(ESP_ROW["GND"], "a"), RL("L-", 4)),
    ("bridge + rail to + rail",   "3v3",    RL("L+", 24), RL("R+", 24)),
    ("bridge - rail to - rail",   "gnd",    RL("L-", 25), RL("R-", 25)),
    ("D15 to gate A node",        "d15",    H(ESP_ROW["D15"], "a"), H(40, "a")),
    ("D4 to gate B node",         "d4",     H(ESP_ROW["D4"], "a"), H(60, "a")),
    ("D18 to coil LED resistor",  "d18",    H(ESP_ROW["D18"], "a"), H(27, "a")),
    ("OLED SDA to D21",           "i2c",    ("o", "SDA"), H(ESP_ROW["D21"], "a")),
    ("OLED SCL to D22",           "i2c",    ("o", "SCL"), H(ESP_ROW["D22"], "a")),
    ("OLED VCC to + rail",        "3v3",    ("o", "VCC"), RL("L+", 18)),
    ("OLED GND to - rail",        "gnd",    ("o", "GND"), RL("L-", 19)),
    ("coil LED cathode to - rail", "gnd",   H(31, "a"), RL("L-", 31)),
    ("gate A 10k to - rail",      "gnd",    H(37, "a"), RL("L-", 37)),
    ("gate A LDR to + rail",      "3v3",    H(42, "a"), RL("L+", 42)),
    ("gate B 10k to - rail",      "gnd",    H(57, "a"), RL("L-", 57)),
    ("gate B LDR to + rail",      "3v3",    H(62, "a"), RL("L+", 62)),
    ("gate A light R to + rail",  "3v3",    H(37, "j"), RL("R+", 37)),
    ("gate A LED cathode to - rail", "gnd", H(41, "j"), RL("R-", 41)),
    ("gate B light R to + rail",  "3v3",    H(57, "j"), RL("R+", 57)),
    ("gate B LED cathode to - rail", "gnd", H(61, "j"), RL("R-", 61)),
]

# Nets the schematic requires. Every terminal in a set must be connected,
# and different sets must NOT be connected to each other.
EXPECTED = {
    "3V3": {"ESP.3V3", "RAIL.L+", "RAIL.R+", "LDRA.2", "LDRB.2", "RLA.1",
            "RLB.1", "OLED.VCC"},
    "GND": {"ESP.GND", "RAIL.L-", "RAIL.R-", "RA.1", "RB.1", "LEDA.K",
            "LEDB.K", "LEDC.K", "OLED.GND"},
    "D15": {"ESP.D15", "RA.2", "LDRA.1"},
    "D4":  {"ESP.D4", "RB.2", "LDRB.1"},
    "D18": {"ESP.D18", "RC.1"},
    "coil_mid": {"RC.2", "LEDC.A"},
    "A_mid": {"RLA.2", "LEDA.A"},
    "B_mid": {"RLB.2", "LEDB.A"},
    "D21": {"ESP.D21", "OLED.SDA"},
    "D22": {"ESP.D22", "OLED.SCL"},
}


# ----------------------------------------------------------------------------
# Netlist check
# ----------------------------------------------------------------------------
def half(col):
    return "L" if col in "abcde" else "R"


def node_of(ep):
    if ep[0] == "h":
        return ("S", half(ep[2]), ep[1])
    if ep[0] == "r":
        return ("RAIL", ep[1])
    return ("O", ep[1])


def verify():
    parent = {}

    def find(a):
        parent.setdefault(a, a)
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a, b):
        parent[find(a)] = find(b)

    errors = []
    terminals = {}  # name -> node

    # wires
    for _, _, a, b in WIRES:
        union(node_of(a), node_of(b))
    # ESP32 left pins sit in column c; right pins in column j (unused)
    for p, r in ESP_ROW.items():
        terminals["ESP." + p] = ("S", "L", r)
    # parts
    for pname, part in PARTS.items():
        for term, r, c in part["legs"]:
            terminals[term] = ("S", half(c), r)
    # rails and off-board pins
    for rail in ("L+", "L-", "R+", "R-"):
        terminals["RAIL." + rail] = ("RAIL", rail)
    for o in ("SDA", "SCL", "VCC", "GND"):
        terminals["OLED." + o] = ("O", o)

    # 1. every expected net is fully connected
    roots = {}
    for net, terms in EXPECTED.items():
        rs = {find(terminals[t]) for t in terms}
        if len(rs) != 1:
            errors.append(f"net {net}: terminals not all connected ({sorted(terms)})")
        roots[net] = find(terminals[sorted(terms)[0]])
    # 2. no two different nets are shorted together
    seen = {}
    for net, r in roots.items():
        if r in seen:
            errors.append(f"SHORT: net {net} is connected to net {seen[r]}")
        seen[r] = net
    # 3. nothing extra is wired into a net
    expected_terms = set().union(*EXPECTED.values())
    for t, n in terminals.items():
        if t in expected_terms:
            continue
        if t.startswith("ESP."):
            r = find(n)
            if r in seen:                      # unused ESP pin touching a net
                errors.append(f"unused pin {t} is connected to net {seen[r]}")

    # hole occupancy: one lead per hole
    used = {}
    def claim(key, what):
        if key in used:
            errors.append(f"hole {key} used twice: {used[key]} and {what}")
        used[key] = what
    for pname, part in PARTS.items():
        for term, r, c in part["legs"]:
            claim(("h", r, c), term)
    for wid, _, a, b in WIRES:
        for ep in (a, b):
            if ep[0] in ("h", "r"):
                claim(ep, wid)
    for p, r in ESP_ROW.items():
        claim(("h", r, "c"), "ESP pin " + p)
        claim(("h", r, "j"), "ESP right pin")

    # ESP32 body covers rows 1..ESP_BODY_LAST_ROW except column a
    for key, what in used.items():
        if key[0] == "h" and key[1] <= ESP_BODY_LAST_ROW and key[2] not in ("a", "c", "j"):
            errors.append(f"hole {key} ({what}) is under the ESP32 board")
        if key[0] == "h" and key[1] <= ESP_BODY_LAST_ROW and key[2] == "a" \
                and not what.startswith(("ESP", "OLED")) and "ESP" not in what and "OLED" not in what:
            pass

    # lead spans (rows apart) so each part physically fits
    need = {"R220": (3, 5), "R10k": (3, 5), "LDR": (2, 2), "LED": (1, 1), "LEDG": (1, 1)}
    for pname, part in PARTS.items():
        rows = [r for _, r, _ in part["legs"]]
        span = abs(rows[1] - rows[0])
        lo, hi = need[part["kind"]]
        if not lo <= span <= hi:
            errors.append(f"{pname}: legs {span} rows apart, want {lo}-{hi}")
        cols = {c for _, _, c in part["legs"]}
        if len(cols) != 1:
            errors.append(f"{pname}: legs in different columns")

    # no part leg shares a strip with its own other leg (would be shorted)
    for pname, part in PARTS.items():
        ns = [("S", half(c), r) for _, r, c in part["legs"]]
        if ns[0] == ns[1]:
            errors.append(f"{pname}: both legs in the same strip")

    # gate spacing
    ga = PARTS["LED_A"]["legs"][0][1]
    gb = PARTS["LED_B"]["legs"][0][1]
    spacing_mm = (gb - ga) * 2.54
    return errors, spacing_mm, len(WIRES)


# ----------------------------------------------------------------------------
# Drawing
# ----------------------------------------------------------------------------
P = 20                      # pixels per hole pitch (0.1 in)
XA = 470                    # x of column a
Y1 = 170                    # y of row 1
NROWS = 63
CI = {"a": 0, "b": 1, "c": 2, "d": 3, "e": 4, "f": 7, "g": 8, "h": 9, "i": 10, "j": 11}
RAILX = {"L+": -3.8, "L-": -2.8, "R-": 13.8, "R+": 14.8}
COL = {"3v3": "#d62828", "gnd": "#3a3a3a", "d15": "#e07b1a", "d4": "#8e44ad",
       "d18": "#2a9d3a", "i2c": "#2f6fde"}


def X(c):
    return XA + (CI[c] if isinstance(c, str) else c) * P


def Y(r):
    return Y1 + (r - 1) * P


def ep_xy(ep, oled_xy):
    if ep[0] == "h":
        return X(ep[2]), Y(ep[1])
    if ep[0] == "r":
        return X(RAILX[ep[1]]), Y(ep[2])
    return oled_xy[ep[1]]


def build_svg():
    out = []
    a = out.append
    W, H_ = 1500, Y(NROWS) + 95

    def txt(x, y, s, size=11, fill="#222", anchor="start", bold=False, extra=""):
        w = ' font-weight="bold"' if bold else ""
        a(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" '
          f'text-anchor="{anchor}"{w} {extra}>{s}</text>')

    def halo_txt(x, y, s, size=11, fill="#222", anchor="start", bold=False):
        w = ' font-weight="bold"' if bold else ""
        a(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" text-anchor="{anchor}"{w} '
          f'stroke="#fff" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">{s}</text>')

    a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H_}" '
      f'font-family="Helvetica,Arial,sans-serif"><rect width="100%" height="100%" fill="#fff"/>')
    txt(W / 2, 40, "Breadboard layout: cut-off timing simulation", 24, bold=True, anchor="middle")
    txt(W / 2, 64, "Full-size 830-point breadboard (63 rows). ESP32 USB end at the top. "
        "Every ESP32 wire lands in column a, the free hole next to each left pin.",
        13, "#555", "middle")

    # ---- board ----
    bx0, bx1 = X(-5.6), X(16.6)
    a(f'<rect x="{bx0}" y="{Y(0)-8}" width="{bx1-bx0}" height="{Y(NROWS)-Y(0)+30}" rx="10" '
      f'fill="#f3f0e6" stroke="#b9b39f" stroke-width="2"/>')
    # centre channel
    a(f'<rect x="{X(4.55)}" y="{Y(0)-8}" width="{X(6.45)-X(4.55)}" height="{Y(NROWS)-Y(0)+30}" fill="#dcd7c6"/>')
    # column letters + holes
    for c in "abcdefghij":
        txt(X(c), Y(0) - 14, c, 12, "#666", "middle", True)
        txt(X(c), Y(NROWS) + 28, c, 12, "#666", "middle", True)
    for r in range(1, NROWS + 1):
        for c in "abcdefghij":
            a(f'<rect x="{X(c)-3}" y="{Y(r)-3}" width="6" height="6" fill="#8a8574"/>')
        lab = str(r)
        b = r % 5 == 0 or r == 1
        txt(X(-5.0), Y(r) + 3.5, lab, 9 if not b else 10, "#888" if not b else "#333", "middle", b)
        txt(X(16.0), Y(r) + 3.5, lab, 9 if not b else 10, "#888" if not b else "#333", "middle", b)
    # rails
    for rail, x in RAILX.items():
        colr = "#d62828" if "+" in rail else "#2f6fde"
        a(f'<line x1="{X(x)}" y1="{Y(0)}" x2="{X(x)}" y2="{Y(NROWS)+8}" stroke="{colr}" stroke-width="2" opacity=".55"/>')
        for r in range(1, NROWS + 1):
            a(f'<rect x="{X(x)-2.5}" y="{Y(r)-2.5}" width="5" height="5" fill="#8a8574"/>')
        sign = "+" if "+" in rail else "−"
        txt(X(x), Y(0) - 14, sign, 18, colr, "middle", True)
        txt(X(x), Y(NROWS) + 30, sign, 18, colr, "middle", True)
    # channel label
    a(f'<text x="{X(5.5)}" y="{Y(21.6)}" font-size="10" fill="#7d7762" text-anchor="middle">centre</text>')
    a(f'<text x="{X(5.5)}" y="{Y(22.4)}" font-size="10" fill="#7d7762" text-anchor="middle">channel</text>')

    # ---- ESP32 ----
    ex0, ex1 = X(1.0), X(12.1)
    ey0, ey1 = Y(0.9), Y(ESP_BODY_LAST_ROW - 0.4)
    a(f'<rect x="{ex0}" y="{ey0}" width="{ex1-ex0}" height="{ey1-ey0}" rx="7" fill="#1b1b1b" opacity=".95"/>')
    a(f'<rect x="{X(5.0)}" y="{ey0-6}" width="{X(6.0)-X(5.0)+30}" height="20" rx="3" fill="#aaa" '
      f'transform="translate(-15 0)"/>')
    txt(X(5.5), ey0 - 12, "USB-C", 11, "#555", "middle")
    a(f'<rect x="{X(3.6)}" y="{Y(11.2)}" width="{X(9.4)-X(3.6)}" height="{Y(19.6)-Y(11.2)}" rx="3" fill="#7a7a7a"/>')
    a(f'<text x="{X(6.5)}" y="{Y(15.4)}" fill="#fff" font-size="14" font-weight="bold" text-anchor="middle">ESP-32</text>')
    used_pin_col = {"3V3": "#d62828", "GND": "#ffffff", "D15": "#e07b1a", "D4": "#8e44ad",
                    "D18": "#2a9d3a", "D21": "#2f6fde", "D22": "#2f6fde"}
    right_pins = ["VIN", "GND", "D13", "D12", "D14", "D27", "D26", "D25", "D33",
                  "D32", "D35", "D34", "VN", "VP", "EN"]
    for p, r in ESP_ROW.items():
        used = p in used_pin_col
        a(f'<circle cx="{X("c")}" cy="{Y(r)}" r="6" fill="{used_pin_col.get(p, "#999")}" '
          f'stroke="#fff" stroke-width="1.5"/>')
        txt(X(2.45), Y(r) + 4, p, 12, "#fff" if used else "#999", "start", used)
    for (p, r) in zip(right_pins, range(ESP_FIRST_ROW, ESP_LAST_ROW + 1)):
        a(f'<circle cx="{X("j")}" cy="{Y(r)}" r="6" fill="#999" stroke="#fff" stroke-width="1.5"/>')
        txt(X(10.55), Y(r) + 4, p, 11, "#999", "end")
    # free-hole rings in column a for the pins we use
    for p in used_pin_col:
        r = ESP_ROW[p]
        a(f'<circle cx="{X("a")}" cy="{Y(r)}" r="7.5" fill="none" stroke="{used_pin_col[p] if p!="GND" else "#333"}" stroke-width="2"/>')
    halo_txt(X(12.35), Y(9), "right pins:", 11, "#555", "start")
    halo_txt(X(12.35), Y(10) - 2, "nothing", 11, "#555", "start")
    halo_txt(X(12.35), Y(11) - 4, "plugged in", 11, "#555", "start")

    # ---- parts ----
    def lead_dot(c, r):
        a(f'<circle cx="{X(c)}" cy="{Y(r)}" r="3.2" fill="#444"/>')

    def resistor(c, r1, r2, bands, label, lab_dx=0.7):
        x = X(c)
        y1, y2 = Y(r1), Y(r2)
        a(f'<line x1="{x}" y1="{y1}" x2="{x}" y2="{y2}" stroke="#9a9a9a" stroke-width="2.5"/>')
        mid = (y1 + y2) / 2
        L = 46
        a(f'<rect x="{x-7}" y="{mid-L/2}" width="14" height="{L}" rx="6" fill="#e9d7a6" stroke="#8c7a3d"/>')
        for i, bc in enumerate(bands):
            yy = mid - L / 2 + 9 + i * 8
            a(f'<rect x="{x-7}" y="{yy}" width="14" height="4" fill="{bc}"/>')
        a(f'<rect x="{x-7}" y="{mid+L/2-9}" width="14" height="3.5" fill="#c9a227"/>')
        lead_dot(c, r1)
        lead_dot(c, r2)
        halo_txt(x + 12, mid + 4, label, 11, "#222", "start", True)

    def led(c, r, color, label=None, aim=None, lab_side="right"):
        x, y = X(c), (Y(r) + Y(r + 1)) / 2
        a(f'<circle cx="{x}" cy="{y}" r="11" fill="{color}" stroke="#222" stroke-width="1.5"/>')
        a(f'<circle cx="{x-3}" cy="{y-3}" r="3" fill="#fff" opacity=".6"/>')
        a(f'<line x1="{x}" y1="{Y(r)}" x2="{x}" y2="{Y(r)+0}" stroke="#444"/>')
        lead_dot(c, r)
        lead_dot(c, r + 1)
        halo_txt(x + 14, Y(r) + 3, "+", 14, "#d62828", "start", True)
        halo_txt(x + 14, Y(r + 1) + 12, "−", 14, "#2f6fde", "start", True)
        if aim:
            ax = x + aim * 17
            a(f'<path d="M{x+aim*13} {y} L{ax+aim*6} {y}" stroke="#222" stroke-width="2"/>')
            a(f'<path d="M{ax+aim*6} {y-4.5} L{ax+aim*12} {y} L{ax+aim*6} {y+4.5} Z" fill="#222"/>')
        if label:
            halo_txt(x + (-14 if lab_side == "left" else 22), Y(r + 1) + 26, label, 10.5, "#222",
                     "end" if lab_side == "left" else "start", True)

    def ldr(c, r1, r2, aim=None):
        x, y = X(c), (Y(r1) + Y(r2)) / 2
        a(f'<line x1="{x}" y1="{Y(r1)}" x2="{x}" y2="{Y(r2)}" stroke="#9a9a9a" stroke-width="2"/>')
        a(f'<circle cx="{x}" cy="{y}" r="12" fill="#d9c9a0" stroke="#6b5a2a" stroke-width="1.5"/>')
        a(f'<path d="M{x-7} {y-5} L{x+2} {y-5} L{x-2} {y} L{x+7} {y} L{x-3} {y+5} L{x+6} {y+5}" '
          f'fill="none" stroke="#6b5a2a" stroke-width="1.6"/>')
        lead_dot(c, r1)
        lead_dot(c, r2)
        if aim:
            ax = x + aim * 17
            a(f'<path d="M{x+aim*14} {y} L{ax+aim*5} {y}" stroke="#222" stroke-width="2"/>')
            a(f'<path d="M{ax+aim*5} {y-4.5} L{ax+aim*11} {y} L{ax+aim*5} {y+4.5} Z" fill="#222"/>')

    RED220 = ["#c62828", "#c62828", "#6d4c1f"]
    BLK10K = ["#6d4c1f", "#111111", "#ef8a17"]

    # light beams + gates first (under parts)
    for ga in (40, 60):
        yb = (Y(ga) + Y(ga + 1)) / 2
        a(f'<line x1="{X("g")-18}" y1="{yb}" x2="{X("d")+18}" y2="{yb}" stroke="#f0b400" '
          f'stroke-width="4" stroke-dasharray="7 5" opacity=".9"/>')

    resistor("b", 27, 30, RED220, "220 Ω")
    led("c", 30, "#35b04a", "coil LED (green)", None, "right")
    resistor("b", 37, 40, BLK10K, "10 kΩ")
    ldr("d", 40, 42, aim=1)
    resistor("h", 37, 40, RED220, "220 Ω")
    led("g", 40, "#ffd23f", "light LED", aim=-1, lab_side="left")
    resistor("b", 57, 60, BLK10K, "10 kΩ")
    ldr("d", 60, 62, aim=1)
    resistor("h", 57, 60, RED220, "220 Ω")
    led("g", 60, "#ffd23f", "light LED", aim=-1, lab_side="left")
    halo_txt(X("d") - 10, Y(43.6), "LDR A", 10.5, "#222", "end", True)
    halo_txt(X("d") - 10, Y(63.6), "LDR B", 10.5, "#222", "end", True)

    # gate tags
    for gy, nm, sub in ((37.9, "GATE A", "coil entrance, D15"), (58.0, "GATE B", "coil centre, D4")):
        halo_txt(X(5.5), Y(gy), nm, 13, "#8a5a00", "middle", True)
        halo_txt(X(5.5), Y(gy) + 14, sub, 10.5, "#8a5a00", "middle")

    # card (the slug) in the channel: pointed nose = direction of travel
    cx = X(5.5)
    cy0, cy1 = Y(44.0), Y(56.2)
    a(f'<path d="M{cx-6} {cy0} H{cx+6} V{cy1-14} L{cx} {cy1} L{cx-6} {cy1-14} Z" fill="#efd9a0" stroke="#8c7a3d" stroke-width="1.5"/>')
    for i, line in enumerate(["card strip = the slug", "30 mm long,", "stands on its edge,", "slides down the", "channel, A then B"]):
        halo_txt(X(6.7), Y(47.0 + i * 1.25), line, 10.5, "#222" if i == 0 else "#444", "start", i == 0)

    # 50.8 mm bracket
    bxx = X(17.4)
    y0, y1 = Y(40.5), Y(60.5)
    a(f'<path d="M{bxx-6} {y0} H{bxx} V{y1} H{bxx-6}" fill="none" stroke="#555" stroke-width="2"/>')
    a(f'<text x="{bxx+14}" y="{(y0+y1)/2}" font-size="12" fill="#333" text-anchor="middle" '
      f'transform="rotate(90 {bxx+14} {(y0+y1)/2})">gate spacing 20 rows = 50.8 mm</text>')

    # ---- OLED (off-board) ----
    ox0, oy0, ow, oh = 70, Y(9.5), 190, 170
    a(f'<rect x="{ox0}" y="{oy0}" width="{ow}" height="{oh}" rx="8" fill="#222"/>')
    a(f'<rect x="{ox0+16}" y="{oy0+20}" width="{ow-60}" height="{oh-60}" rx="3" fill="#0b2a4a"/>')
    txt(ox0 + 16 + (ow - 60) / 2, oy0 + 20 + (oh - 60) / 2 + 4, "OLED", 16, "#8fd0ff", "middle", True)
    txt(ox0 + 16 + (ow - 60) / 2, oy0 + 20 + (oh - 60) / 2 + 22, "SSD1306", 11, "#8fd0ff", "middle")
    oled_xy = {}
    pins = ["SDA", "SCL", "VCC", "GND"]
    for i, pn in enumerate(pins):
        py = oy0 + 26 + i * 38
        a(f'<rect x="{ox0+ow-6}" y="{py-5}" width="12" height="10" fill="#c9a227"/>')
        txt(ox0 + ow - 12, py + 4, pn, 11, "#fff", "end", True)
        oled_xy[pn] = (ox0 + ow + 6, py)
    txt(ox0 + ow / 2, oy0 - 26, "OLED (off the board)", 13, "#222", "middle", True)
    txt(ox0 + ow / 2, oy0 - 10, "4 female-to-male wires", 11, "#555", "middle")
    txt(ox0 + ow / 2, oy0 + oh + 16, "match wires by the pin LABELS", 11, "#a00", "middle", True)
    txt(ox0 + ow / 2, oy0 + oh + 31, "printed on your module", 11, "#a00", "middle", True)

    # ---- wires ----
    lane = {"D18": -0.6, "D15": -1.1, "D4": -1.6}

    def wire_path(wid, key, A, B):
        (x1, y1), (x2, y2) = ep_xy(A, oled_xy), ep_xy(B, oled_xy)
        if A[0] == "r" and B[0] == "r":                         # rail bridge
            up = -1 if "+" in A[1] else 1
            cy = (y1 + y2) / 2 + up * 52
            return f'M{x1} {y1} Q{(x1+x2)/2} {cy} {x2} {y2}'
        if A[0] == "o":                                         # OLED jumper
            return f'M{x1} {y1} C{x1+90} {y1} {x2-120} {y2} {x2} {y2}'
        if A[0] == "h" and B[0] == "h" and A[2] == "a" and B[2] == "a":   # lane wires
            lx = X(lane[key_name[wid]])
            rr = 8
            sgn = 1 if y2 > y1 else -1
            return (f'M{x1} {y1} H{lx+rr} Q{lx} {y1} {lx} {y1+sgn*rr} V{y2-sgn*rr} '
                    f'Q{lx} {y2} {lx+rr} {y2} H{x2}')
        # short hop hole <-> rail on the same row
        cy = y1 - 11
        return f'M{x1} {y1} Q{(x1+x2)/2} {cy} {x2} {y2}'

    key_name = {"D15 to gate A node": "D15", "D4 to gate B node": "D4",
                "D18 to coil LED resistor": "D18"}
    for wid, key, A, B in WIRES:
        d = wire_path(wid, key, A, B)
        c = COL[key]
        a(f'<path d="{d}" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>')
        a(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="4.5" stroke-linecap="round"/>')
        for ep in (A, B):
            if ep[0] == "o":
                continue
            x, y = ep_xy(ep, oled_xy)
            a(f'<circle cx="{x}" cy="{y}" r="4.2" fill="{c}" stroke="#fff" stroke-width="1.5"/>')
    for pn, (x, y) in oled_xy.items():
        a(f'<circle cx="{x}" cy="{y}" r="3" fill="#fff"/>')
    halo_txt(X(9.3), Y(28.2), "rail bridges", 10.5, "#444", "middle")
    halo_txt(X(9.3), Y(29.4), "rows 24 and 25", 10.5, "#444", "middle")

    # ---- right panel ----
    px = X(19.8)
    y = Y(1) - 6
    txt(px, y, "Parts", 18, "#111", "start", True)
    parts = [
        ("ESP32 dev board", "x1", "left pins col c, right pins col j"),
        ("OLED SSD1306, 4 pin", "x1", "off board, 4 F-to-M wires"),
        ("LDR (photoresistor)", "x2", "gate sensors"),
        ("Resistor 10 kΩ (brn-blk-org)", "x2", "one per LDR"),
        ("Resistor 220 Ω (red-red-brn)", "x3", "one per LED"),
        ("LED, any bright colour", "x2", "gate light sources"),
        ("LED, green", "x1", 'the "coil" indicator'),
        ("Jumper wires, male-to-male", "x16", ""),
        ("Jumper wires, female-to-male", "x4", "for the OLED"),
        ("Card strip, 30 x 12 mm", "x1", "tape to a pencil"),
    ]
    y += 24
    for nm, q, note in parts:
        txt(px, y, nm, 12.5, "#222", "start", True)
        txt(px + 260, y, q, 12.5, "#222", "start", True)
        if note:
            txt(px + 305, y, note, 11.5, "#666", "start")
        y += 21
    y += 14
    txt(px, y, "Wires (hole = row number + column letter)", 18, "#111", "start", True)
    y += 8
    legend = {"3v3": "red", "gnd": "black", "d15": "orange", "d4": "purple",
              "d18": "green", "i2c": "blue"}
    def fmt(ep):
        if ep[0] == "h":
            return f"{ep[1]}{ep[2]}"
        if ep[0] == "r":
            return f"{ep[1].replace('-', chr(8722))} rail"
        return "OLED " + ep[1]
    pretty = {
        "ESP 3V3 to + rail": "ESP32 3V3",
        "ESP GND to - rail": "ESP32 GND",
        "bridge + rail to + rail": "bridge",
        "bridge - rail to - rail": "bridge",
        "D15 to gate A node": "D15 → gate A node",
        "D4 to gate B node": "D4 → gate B node",
        "D18 to coil LED resistor": "D18 → coil resistor",
        "OLED SDA to D21": "OLED SDA → D21",
        "OLED SCL to D22": "OLED SCL → D22",
        "OLED VCC to + rail": "OLED VCC",
        "OLED GND to - rail": "OLED GND",
        "coil LED cathode to - rail": "coil LED −",
        "gate A 10k to - rail": "gate A 10 kΩ",
        "gate A LDR to + rail": "gate A LDR",
        "gate B 10k to - rail": "gate B 10 kΩ",
        "gate B LDR to + rail": "gate B LDR",
        "gate A light R to + rail": "gate A light 220 Ω",
        "gate A LED cathode to - rail": "gate A light LED −",
        "gate B light R to + rail": "gate B light 220 Ω",
        "gate B LED cathode to - rail": "gate B light LED −",
    }
    # LED/LDR hole -> rail wires use the left (L) or right (R) rails
    for n, (wid, key, A, B) in enumerate(WIRES, 1):
        y += 20
        c = COL[key]
        a(f'<rect x="{px}" y="{y-11}" width="26" height="9" rx="3" fill="{c}"/>')
        txt(px + 34, y - 2, f"{n:>2}", 11.5, "#888", "start", True)
        label = pretty[wid]
        if A[0] == "r" and B[0] == "r":
            where = f"{fmt(A)} row {A[2]} → {fmt(B)} row {B[2]}"
        elif A[0] == "o":
            where = f"OLED pin → {fmt(B)}" if B[0] == "h" else f"OLED pin → {B[1].replace('-', chr(8722))} rail"
        else:
            where = f"hole {fmt(A)} → " + (fmt(B) if B[0] == "h" else f"{B[1].replace('-', chr(8722))} rail")
        txt(px + 58, y - 2, label, 12, "#222", "start", True)
        txt(px + 270, y - 2, where, 11.5, "#555", "start")
    y += 36
    txt(px, y, "Before you plug in USB", 18, "#a00", "start", True)
    notes = [
        "1. Multimeter on beep: touch the + and − rail on the left. Silent. Same on the right.",
        "2. Same check from the left + rail to the right + rail: it should beep (bridged).",
        "3. LED long leg (+) goes on the upper row, the flat-edge short leg below it.",
        "4. Resistors and LDRs have no polarity. Resistor legs can be bent to reach.",
        "5. Lean each LED and LDR over so they face each other across the channel.",
        "6. Add parts in stages and feel the chip near the USB port after each.",
    ]
    for n in notes:
        y += 20
        txt(px, y, n, 12, "#222", "start")

    a("</svg>")
    return "\n".join(out)


if __name__ == "__main__":
    errs, spacing, nwires = verify()
    print(f"wires: {nwires}   gate spacing: {spacing:.1f} mm")
    if errs:
        print("NETLIST CHECK FAILED")
        for e in errs:
            print("  -", e)
        sys.exit(1)
    print("netlist check passed: all nets as designed, no shorts, no hole used twice")
    out = sys.argv[1] if len(sys.argv) > 1 else "breadboard_layout.svg"
    with open(out, "w", encoding="utf-8") as f:
        f.write(build_svg())
    print("wrote", out)
