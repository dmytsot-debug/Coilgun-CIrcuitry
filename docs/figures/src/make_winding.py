"""Coil winding figure: side section, end view and per-layer wire length.

Writes coil-winding.svg next to this script; render with
  node docs/figures/src/render.js 2 docs/figures/coil-winding.png coil-winding.svg 720 510
"""
import math
import os

RI, CORE_IN, SLUG_R = 7.5, 6.0, 5.55      # mm: coil inner radius (core OD / 2), core bore radius, slug radius
DEPTH, LAYERS, NL, PITCH = 4.38, 4, 41, 1.10
LP = DEPTH / LAYERS
OHM_M = 0.0209
CU = ["#e8a05c", "#d98a3d"]

out = []
a = out.append


def text(x, y, s, size=8, anchor="start", weight="normal", fill="#222"):
    a(f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" fill="{fill}">{s}</text>')


def line(x1, y1, x2, y2, stroke="#222", w=0.8):
    a(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{w}"/>')


def arrow(x1, x2, y, stroke="#1f5f9e"):
    line(x1, y, x2, y, stroke)
    d = 1 if x2 > x1 else -1
    a(f'<polygon points="{x2},{y} {x2 - 4*d},{y - 2} {x2 - 4*d},{y + 2}" fill="{stroke}"/>')


a('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="510" viewBox="0 0 720 510" font-family="Times New Roman, serif">')
a('<rect width="720" height="510" fill="#fff"/>')
text(360, 22, "Coil Winding — Wire Layering", 13, "middle", "bold")

# ---------------------------------------------------------------- A. side section, 20 px/mm
S = 20
text(25, 47, "A. Side Section Through One Wall of the Coil (40 px = 1 mm)", 10, weight="bold")
X0, YB = 77, 180                     # x of first turn, y of the core's outer surface
for j in range(LAYERS):
    yc = YB - (j + 0.5) * LP * S
    text(25, yc + 3, f"Layer {j + 1}", 8, weight="bold")
    for k in range(11):
        a(f'<circle cx="{X0 + (k + 0.5) * PITCH * S:.1f}" cy="{yc:.1f}" r="{PITCH * S / 2:.1f}" fill="{CU[j % 2]}" stroke="#7a4313" stroke-width="0.6"/>')
    xa, xb = (335, 366) if j % 2 == 0 else (366, 335)
    arrow(xa, xb, yc)
xr = X0 + 11 * PITCH * S
yt = YB - DEPTH * S
line(X0, 65, X0 + PITCH * S, 65); text(X0 - 11, 58, "pitch 1.10 mm", 7.5)
text(426, 83, "… continues to 41 turns per layer", 6.5, "end", fill="#444")
line(378, yt, 378, YB); line(374, yt, 382, yt); line(374, YB, 382, YB)
text(384, 138, "4.38 mm", 7.5); text(384, 148, "winding depth", 7, fill="#444")
core_h = (RI - CORE_IN) * S
a(f'<rect x="{X0 - 15}" y="{YB}" width="{xr - X0 + 30:.1f}" height="{core_h:.1f}" fill="#d9d4ea" stroke="#8a80b0" stroke-width="0.8"/>')
text(xr + 22, YB + core_h / 2 + 3, "Printed core wall, 1.5 mm", 7.5, fill="#5b5090")
gap = (CORE_IN - SLUG_R) * S
a(f'<rect x="{X0 - 15}" y="{YB + core_h + gap:.1f}" width="{xr - X0 + 30:.1f}" height="8" fill="#8f979e"/>')
text(xr + 22, YB + core_h + gap + 7, "Projectile surface (0.45 mm gap)", 7.5, fill="#444")
line(X0 + 3.2 * PITCH * S, YB - 0.5 * LP * S + 8, 165, 238, stroke="#7a4313", w=0.6)
text(167, 241, "1.02 mm copper + enamel ≈ 1.10 mm overall", 7.5, fill="#7a4313")
text(X0 - 15, 260, f"Coil axis lies {SLUG_R:.2f} mm below the projectile surface (not shown).", 7, fill="#444")

# ---------------------------------------------------------------- B. end view, 10 px/mm
E = 10
CX, CY = 555, 172
text(452, 47, "B. End View (20 px = 1 mm)", 10, weight="bold")
for j in reversed(range(LAYERS)):
    a(f'<circle cx="{CX}" cy="{CY}" r="{(RI + (j + 1) * LP) * E:.1f}" fill="{CU[j % 2]}" stroke="#7a4313" stroke-width="0.6"/>')
a(f'<circle cx="{CX}" cy="{CY}" r="{RI * E}" fill="#d9d4ea" stroke="#8a80b0" stroke-width="0.8"/>')
a(f'<circle cx="{CX}" cy="{CY}" r="{CORE_IN * E}" fill="#fff" stroke="#8a80b0" stroke-width="0.8"/>')
a(f'<circle cx="{CX}" cy="{CY}" r="{SLUG_R * E}" fill="#8f979e" stroke="#555" stroke-width="0.8"/>')
text(CX, CY + 3, "Projectile", 7.5, "middle", "bold", "#fff")
text(CX, CY - SLUG_R * E - 2.5, "Core", 5.5, "middle", fill="#5b5090")
for j in range(LAYERS):
    rr = (RI + (j + 0.5) * LP) * E
    text(CX, CY - rr + 2.5, str(j + 1), 6.5, "middle", "bold", "#fff")
    text(CX, CY + rr + 2.5, str(j + 1), 6.5, "middle", "bold", "#fff")
OD = 2 * (RI + DEPTH)
yd = CY + OD / 2 * E + 16
line(CX - OD / 2 * E, yd, CX + OD / 2 * E, yd); line(CX - OD / 2 * E, yd - 4, CX - OD / 2 * E, yd + 4); line(CX + OD / 2 * E, yd - 4, CX + OD / 2 * E, yd + 4)
text(CX, yd + 12, f"Coil OD ≈ {OD:.1f} mm", 7.5, "middle")
text(CX, yd + 22, "Coil ID = printed core OD = 15.0 mm · bore 12.0 mm", 7, "middle", fill="#5b5090")
text(452, 58, "Ring numbers = layer (see C)", 6.5, fill="#444")

# ---------------------------------------------------------------- C. table
text(25, 348, f"C. Layer Radii and Wire Length ({NL} turns per layer)", 10, weight="bold")
cols = [25, 128, 257, 390, 514]
heads = ["Layer", "Mean radius, r<tspan baseline-shift='sub' font-size='5'>j</tspan>", "Circumference, 2πr<tspan baseline-shift='sub' font-size='5'>j</tspan>",
         "Wire per layer, 2πr<tspan baseline-shift='sub' font-size='5'>j</tspan> × 41", "Axial winding direction"]
for c, h in zip(cols, heads):
    text(c, 370, h, 7.5, weight="bold")
line(25, 376, 694, 376)
total = 0
for j in range(LAYERS):
    r = RI + (j + 0.5) * LP
    w = 2 * math.pi * r * NL / 1000
    total += w
    y = 392 + 16.5 * j
    d = "Breech → muzzle" if j % 2 == 0 else "Muzzle → breech"
    for c, v in zip(cols, [str(j + 1), f"{r:.2f} mm", f"{2 * math.pi * r:.1f} mm", f"{w:.2f} m", d]):
        text(c, y, v, 7.5)
line(25, 449, 694, 449)
text(25, 462, "Total", 7.5, weight="bold")
text(cols[3], 462, f"{total:.2f} m → R = {total:.2f} × {OHM_M} = {total * OHM_M:.3f} Ω", 7.5, weight="bold")
text(25, 482, "Winding note: wind every layer in the same rotational direction (e.g. clockwise viewed from the breech); only the axial direction reverses", 7, fill="#1f5f9e")
text(25, 493, "at the end of each layer. With an even number of layers, both leads finish at the breech end of the coil. Cut about 10.5 m to leave leads.", 7, fill="#1f5f9e")
a("</svg>")

open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "coil-winding.svg"), "w", encoding="utf-8").write("\n".join(out))
print(f"wire {total:.3f} m, R {total * OHM_M:.4f} ohm, OD {OD:.2f} mm")
