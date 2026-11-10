"""System diagram for the coil launcher: circuit schematic + to-scale cross-section.
Writes system-diagram.svg next to this script. Panel B at 5 px/mm (10 px/mm when rendered at 2x)."""
import os

W, H = 900, 700
F = "font-family:'Liberation Serif','Times New Roman',serif"
o = []
a = o.append


def text(x, y, s, size=9, anchor="start", weight="normal", fill="#222", style=""):
    a(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}" style="{F};{style}">{s}</text>')


def line(x1, y1, x2, y2, stroke="#222", w=1.4, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    a(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{w}"{d}/>')


def dot(x, y):
    a(f'<circle cx="{x}" cy="{y}" r="2.6" fill="#222"/>')


def resistor_v(x, y1, y2, zig_len=44, amp=6, n=6):
    mid = (y1 + y2) / 2
    z1, z2 = mid - zig_len / 2, mid + zig_len / 2
    pts = [(x, y1), (x, z1)]
    step = zig_len / n
    for k in range(n):
        pts.append((x + (amp if k % 2 == 0 else -amp), z1 + step * (k + 0.5)))
    pts += [(x, z2), (x, y2)]
    a('<polyline fill="none" stroke="#222" stroke-width="1.4" points="' + " ".join(f"{px:.1f},{py:.1f}" for px, py in pts) + '"/>')


def cap_v(x, y1, y2):
    mid = (y1 + y2) / 2
    line(x, y1, x, mid - 4)
    line(x, mid + 4, x, y2)
    line(x - 15, mid - 4, x + 15, mid - 4, w=2)
    line(x - 15, mid + 4, x + 15, mid + 4, w=2)
    text(x - 22, mid - 9, "+", 9)


def coil_v(x, y1, y2, n=5):
    h = (y2 - y1) / n
    d = f"M{x},{y1} "
    for k in range(n):
        d += f"a {h/2:.2f},{h/2:.2f} 0 0 1 0,{h:.2f} "
    a(f'<path d="{d}" fill="none" stroke="#222" stroke-width="1.4"/>')


def diode_up(x, y1, y2):
    """Diode with cathode toward y1 (top)."""
    mid = (y1 + y2) / 2
    line(x, y1, x, mid - 9)
    line(x, mid + 9, x, y2)
    a(f'<polygon points="{x-10},{mid+9} {x+10},{mid+9} {x},{mid-9}" fill="none" stroke="#222" stroke-width="1.4"/>')
    line(x - 10, mid - 9, x + 10, mid - 9, w=1.6)


def box(x, y, w, h, stroke="#222", fill="#fff", sw=1.4):
    a(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')


RED = "#b0182a"
NEW = "#1d5fa8"  # colour for the components added in this revision

# ---------------------------------------------------------------- title
text(W / 2, 32, "Inductive Coil Launcher — System Diagram", 15, "middle", "bold")
text(40, 78, "A. Circuit Schematic", 11, weight="bold")

# ---------------------------------------------------------------- panel A
TOP, BOT = 140, 330
XL, XR = 95, 640
# rails
line(XL, TOP, 395, TOP)
line(455, TOP, XR, TOP)
line(XL, BOT, XR, BOT)
# charger
box(60, 205, 70, 62)
text(95, 228, "Charger", 9, "middle")
text(95, 242, "126 V", 9, "middle")
text(95, 256, "(auto-stop)", 7, "middle", fill="#555")
line(XL, TOP, XL, 205)
line(XL, 267, XL, BOT)
text(80, 197, "+", 9)
text(80, 282, "−", 9)

# balancing resistors
XB = 165
MIDY = (TOP + BOT) / 2
resistor_v(XB, TOP, MIDY)
resistor_v(XB, MIDY, BOT)
dot(XB, TOP); dot(XB, BOT); dot(XB, MIDY)
text(XB - 14, MIDY - 50, "R", 9, "end")
text(XB - 12, MIDY - 39, "10 kΩ", 7, "end")
text(XB - 14, MIDY + 42, "R", 9, "end")
text(XB - 12, MIDY + 53, "10 kΩ", 7, "end")
text(XB, BOT + 22, "Balancing resistors (1 W)", 7.5, "middle", fill="#444")

# capacitors
XC = 222
cap_v(XC, TOP, MIDY)
cap_v(XC, MIDY, BOT)
dot(XC, TOP); dot(XC, BOT); dot(XC, MIDY)
line(XB, MIDY, XC, MIDY)
text(XC + 22, (TOP + MIDY) / 2 - 2, "C₁", 9)
text(XC + 22, (TOP + MIDY) / 2 + 10, "0.1 F, 63 V", 7.5)
text(XC + 22, (MIDY + BOT) / 2 - 2, "C₂", 9)
text(XC + 22, (MIDY + BOT) / 2 + 10, "0.1 F, 63 V", 7.5)

# NEW: bank bleeder across the whole series bank
XBL = 300
resistor_v(XBL, TOP, BOT, zig_len=60, amp=6, n=8)
dot(XBL, TOP); dot(XBL, BOT)
text(XBL + 12, MIDY - 10, 'R<tspan baseline-shift="sub" font-size="6.5">bleed</tspan>', 9, fill=NEW, weight="bold")
text(XBL + 12, MIDY + 5, "1 kΩ, 25 W", 7.5, fill=NEW)
text(XBL + 12, MIDY + 16, "across bank", 7, fill=NEW)

text(XC + 22, BOT - 8, 'Series bank C<tspan baseline-shift="sub" font-size="5.5">T</tspan> = 0.05 F, 126 V', 7.5, fill="#444")

# IGBT
box(395, TOP - 14, 60, 28)
text(425, TOP - 1, "IGBT", 9, "middle", "bold")
text(425, TOP + 9, "switch", 6.5, "middle", fill="#555")
text(425, TOP - 22, "≥ 200 V, ≥ 600 A pulse", 6.5, "middle", fill="#555")
# current arrow
a(f'<polygon points="{478},{TOP-4} {478},{TOP+4} {486},{TOP}" fill="#222"/>')
text(494, TOP - 6, '<tspan font-weight="bold" font-size="9">I</tspan><tspan baseline-shift="sub" font-size="6">peak</tspan> ≈ 405 A', 7.5)

# gate driver
box(385, 205, 80, 30)
text(425, 218, "Gate driver", 8, "middle")
text(425, 229, "(trigger / cut-off)", 6.5, "middle", fill="#555")
line(425, 205, 425, TOP + 22, dash="3,3")
a(f'<polygon points="{421},{TOP+22} {429},{TOP+22} {425},{TOP+15}" fill="#222"/>')
line(425, 235, 425, 400, stroke=RED, dash="4,3", w=1.1)
text(432, 392, "Cut-off signal from optical gate", 7, fill=RED)

# coil
XK = 555
line(XK, TOP, XK, 170)
coil_v(XK, 170, 300)
line(XK, 300, XK, BOT)
dot(XK, TOP); dot(XK, BOT)
text(XK - 18, 214, "Coil", 9, "end", "bold")
text(XK - 18, 227, "L = 171 µH", 7.5, "end")
text(XK - 18, 239, 'R<tspan baseline-shift="sub" font-size="5.5">coil</tspan> = 0.220 Ω', 7.5, "end")
text(XK - 18, 251, "164 turns", 7.5, "end")

# flyback branch: diode in series with R_fb
XF = 640
line(XR, TOP, XF, TOP)
diode_up(XF, TOP, 232)
resistor_v(XF, 232, BOT, zig_len=40, amp=6, n=6)
text(XF + 16, 182, "Flyback", 7.5)
text(XF + 16, 192, "diode", 7.5)
text(XF + 16, 202, "MBR60200W, 600 A surge", 6.5, fill="#555")
text(XF + 12, 279, 'R<tspan baseline-shift="sub" font-size="6.5">fb</tspan>', 9, fill=NEW, weight="bold")
text(XF + 12, 290, "0.20 Ω", 7.5, fill=NEW)
text(XF + 12, 301, "pulse-rated", 7, fill=NEW)

# key values
KX, KY, KW = 715, 112, 160
rows = [
    ("Bank voltage", "126 V"),
    ("Stored energy", "397 J"),
    ("Total resistance", "0.280 Ω"),
    ("Inductance", "171 µH"),
    ("Peak current", "≈ 405 A"),
    ("Field at centre", "≈ 1.67 T"),
    ("Cut-off time", "≈ 5.19 ms"),
    ("Switch at turn-off", "≈ 158 V"),
    ("Exit velocity (sim.)", "18.9 m/s"),
    ("Muzzle velocity (exp.)", "16–17.5 m/s"),
    ("Efficiency", "≈ 1.6 %"),
    ("Bleed to 5 V", "≈ 2.7 min"),
]
KH = 34 + 16.5 * len(rows)
box(KX, KY, KW, KH, stroke="#999", fill="#fafafa", sw=1)
text(KX + KW / 2, KY + 20, "Key Values", 9.5, "middle", "bold")
for k, (n_, v_) in enumerate(rows):
    y = KY + 40 + 16.5 * k
    text(KX + 10, y, n_, 7.5)
    text(KX + KW - 10, y, v_, 7.5, "end", "bold")

# legend for new parts
text(KX, KY + KH + 16, "Blue: bleeder and flyback resistor", 7, fill=NEW)

# ---------------------------------------------------------------- panel B (to scale, 5 px/mm)
S = 5.0
text(40, 430, "B. Coil, Barrel and Projectile Cross-Section (to scale, 10 px = 1 mm)", 11, weight="bold")
AX = 545            # axis y
X0 = 150            # projectile tail
LP = 45.6 * S       # projectile / coil length
XC0 = X0 + LP       # coil entrance = projectile nose
XC1 = XC0 + LP      # coil exit
bore, bod = 12.0 * S / 2, 16.0 * S / 2   # tube bore, tube OD (= coil ID)
cod = 24.76 * S / 2
FLW, FLR = 2.5 * S, 30.0 * S / 2          # printed discs: 2.5 mm thick, 30 mm across, glued to the tube
# one clear tube, 12 mm bore, 16 mm OD, straight through the coil
for sgn in (-1, 1):
    y_in, y_out = AX + sgn * bore, AX + sgn * bod
    a(f'<rect x="95" y="{min(y_in, y_out):.2f}" width="{820-95}" height="{abs(y_out-y_in):.2f}" fill="#cfe2f3" stroke="#7aa7d1" stroke-width="0.8"/>')
# printed end discs
for sgn in (-1, 1):
    for xd in (XC0 - FLW, XC1):
        y1, y2 = AX + sgn * bod, AX + sgn * FLR
        a(f'<rect x="{xd:.2f}" y="{min(y1, y2):.2f}" width="{FLW:.2f}" height="{abs(y2-y1):.2f}" fill="#d9d4ea" stroke="#8a80b0" stroke-width="0.8"/>')
# coil winding: 4 layers x 41 turns each side
pitch = 1.10 * S
lay = 4.38 * S / 4
for sgn in (-1, 1):
    ytop = AX - cod if sgn < 0 else AX + bod
    a(f'<rect x="{XC0:.2f}" y="{ytop:.2f}" width="{LP:.2f}" height="{cod-bod:.2f}" fill="#e8913a" stroke="#c46f1c" stroke-width="0.8"/>')
    for L_ in range(4):
        yc = (AX - bod - lay * (L_ + 0.5)) if sgn < 0 else (AX + bod + lay * (L_ + 0.5))
        for t_ in range(41):
            xc = XC0 + pitch * (t_ + 0.5)
            a(f'<circle cx="{xc:.2f}" cy="{yc:.2f}" r="{lay*0.32:.2f}" fill="#fbd7a8"/>')
text((XC0 + XC1) / 2 - 20, AX - cod - 40, "Coil: 1.02 mm enamelled copper, 4 layers × 41 turns = 164 turns", 8, "middle", "bold", fill="#b05d10")
# projectile
pr = 11.1 * S / 2
a(f'<rect x="{X0}" y="{AX-pr}" width="{LP:.2f}" height="{2*pr}" rx="3" fill="#8f979e" stroke="#5f666c" stroke-width="1"/>')
text(X0 + LP / 2, AX + 3, "Mild steel projectile, 34.6 g", 8.5, "middle", "bold", fill="#fff")
# diameter callouts
line(X0 - 10, AX - pr, X0 - 10, AX + pr, w=0.8)
text(X0 - 16, AX + 3, "Ø 11.1 mm", 7.5, "end")
line(XC0 + 12, AX - bore, XC0 + 12, AX + bore, w=0.8)
text(XC0 + 18, AX + 3, "Ø 12 mm bore", 7.5)
# coil centre
xcm = (XC0 + XC1) / 2
line(xcm, AX - cod - 12, xcm, AX + cod + 6, stroke="#666", w=0.8, dash="3,3")
text(xcm, AX - cod - 15, "Coil centre", 7, "middle", fill="#666")
# OD dimension
line(XC1 + 60, AX - cod, XC1 + 60, AX + cod, w=0.8)
line(XC1 + 54, AX - cod, XC1 + 66, AX - cod, w=0.8)
line(XC1 + 54, AX + cod, XC1 + 66, AX + cod, w=0.8)
text(XC1 + 70, AX - 2, "Ø 24.8 mm", 7.5)
text(XC1 + 70, AX + 9, "(coil OD)", 7.5)
# optical gate at coil exit
xg = XC1 + 6.5 * S   # beam 6.5 mm past the coil end
a(f'<rect x="{xg-5}" y="{AX-FLR-18}" width="10" height="10" fill="{RED}"/>')
a(f'<rect x="{xg-5}" y="{AX+FLR+8}" width="10" height="10" fill="{RED}"/>')
line(xg, AX - FLR - 8, xg, AX + FLR + 8, stroke=RED, w=0.8, dash="2,2")
text(xg + 9, AX - FLR - 11, "IR LED", 7, fill=RED)
text(xg + 9, AX + FLR + 17, "Phototransistor", 7, fill=RED)
text(xg + 9, AX - FLR - 22, "Optical gate", 8, "start", "bold", fill=RED)
# signal back to gate driver
line(425, 400, xg, 400, stroke=RED, dash="4,3", w=1.1)
line(xg, 400, xg, AX - FLR - 18, stroke=RED, dash="4,3", w=1.1)
# travel arrow
line(185, 455, 290, 455, stroke="#1f6fb2", w=1.6)
a('<polygon points="290,451 290,459 299,455" fill="#1f6fb2"/>')
text(242, 448, "Direction of travel", 8, "middle", fill="#1f6fb2")
text(242, 470, "Start: nose at coil entrance", 7, "middle", fill="#555")
text(100, AX + FLR + 14, "Clear acrylic tube: 12 mm bore, 16 mm OD (= coil ID). Coil wound on it between two printed discs", 7, fill="#4a7aa8")
# length dimensions
yd = AX + cod + 38
for x1, x2, lab in ((X0, XC0, "Projectile length"), (XC0, XC1, "Coil length")):
    line(x1, yd, x2, yd, w=0.8)
    line(x1, yd - 5, x1, yd + 5, w=0.8)
    line(x2, yd - 5, x2, yd + 5, w=0.8)
    text((x1 + x2) / 2, yd + 13, "45.6 mm", 8, "middle")
    text((x1 + x2) / 2, yd + 23, lab, 7, "middle", fill="#555")

svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#fff"/>' + "".join(o) + "</svg>"
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "system-diagram.svg"), "w").write(svg)
print("ok")
