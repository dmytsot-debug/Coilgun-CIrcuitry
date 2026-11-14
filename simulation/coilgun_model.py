"""Single-stage coilgun model: hand calculations + time-domain simulation.

Recomputes the hand calculations of docs/theoretical-framework.md from the design
parameters, then runs the circuit + projectile simulation. The coil here is the
1.6 mm re-baseline (6 x 27 turns); the framework document's body still derives the
earlier 1.02 mm, 4 x 41 coil.

Model (matches the framework document):
  * Circuit: series RLC, C_T = 0.05 F at 126 V, L = 279 uH (Wheeler), R = 0.184 ohm,
    with the 1 kohm bank bleeder and the two 10 kohm balancing resistors as a leak.
    Inductance is held constant and the slug's back-EMF is ignored (the document's
    assumption). Pass --back-emf to couple the slug's motional EMF into the circuit.
  * Field: Biot-Savart sum over all 162 loops (6 layers x 27 turns of 1.6 mm wire), off-axis via
    elliptic integrals, averaged over the slug cross-section.
  * Force: slug uniformly magnetised along the axis at M = min(M_s, mu_eff*B/mu0),
    F = M * integral over the end faces of [B_z(front) - B_z(back)] dA.
  * Cut-off: the switch opens when the slug centre reaches the coil centre
    (nose at coil exit). After that the coil current freewheels through the
    flyback diode and decays through R_coil + R_flyback (0.20 ohm).

Usage:
  python3 simulation/coilgun_model.py             # document model
  python3 simulation/coilgun_model.py --back-emf  # adds slug back-EMF
  python3 simulation/coilgun_model.py --no-cutoff # switch never opens
  python3 simulation/coilgun_model.py --flyback-r 0     # diode only, no flyback resistor
  python3 simulation/coilgun_model.py --volts 100       # charge the bank to 100 V
  python3 simulation/coilgun_model.py --sim-json model3d/sim.json   # traces for the 3D bench

Only needs numpy.
"""

import argparse
import math

import numpy as np

MU0 = 4e-7 * math.pi

# ---------------------------------------------------------------- parameters
P = dict(
    C_each=0.1,          # F, each capacitor
    V_each=63.0,         # V, each capacitor's rating and charge voltage
    n_series=2,
    m=34.6e-3,           # kg, projectile mass (7/16 in rod, 45.6 mm long)
    rho_steel=7850.0,    # kg/m^3
    d_p=11.1e-3,         # m, projectile diameter (7/16 in mild steel rod)
    v_target=20.0,       # m/s
    mu_r=500.0,          # low-carbon steel
    B_sat=1.6,           # T
    l_coil=45.6e-3,      # m, coil length
    r_inner=9.15e-3,     # m, coil inner radius (printed holder: 16.3 mm bore over the tube + 1 mm wall)
    layers=6,
    d_wire=1.60e-3,      # m, bare copper diameter (the wire on hand)
    d_wire_enamel=1.68e-3,
    c_wind=10.08e-3,     # m, winding depth (6 layers x 1.68 mm)
    ohm_per_m=0.00855,   # 1.60 mm copper: 1.72e-8 / area
    R_ext=0.060,         # ohm, ESR + switch + leads (estimate)
    R_bal=10e3,          # ohm, balancing resistor per capacitor
    rho_cu=8960.0,
    c_cu=385.0,
    V_diode=0.9,         # V, flyback diode forward drop while freewheeling
    R_flyback=0.20,      # ohm, resistor in series with the flyback diode
    R_bleed=1000.0,      # ohm, bank bleeder across the whole series bank
)


def ellip_KE(m):
    """Complete elliptic integrals K(m), E(m), parameter m = k^2, via AGM."""
    m = np.asarray(m, dtype=float)
    a = np.ones_like(m)
    b = np.sqrt(1.0 - m)
    c = np.sqrt(m)
    s = 0.5 * c * c
    p = 1.0
    for _ in range(30):
        an = 0.5 * (a + b)
        bn = np.sqrt(a * b)
        c = 0.5 * (a - b)
        p *= 2.0
        s = s + p * 0.5 * c * c
        a, b = an, bn
    K = math.pi / (2.0 * a)
    E = K * (1.0 - s)
    return K, E


def loop_Bz(a, rho, z):
    """Axial field (T per A) of a single loop of radius a at (rho, z)."""
    rho = np.asarray(rho, dtype=float)
    z = np.asarray(z, dtype=float)
    q = (a + rho) ** 2 + z ** 2
    m = 4.0 * a * rho / q
    K, E = ellip_KE(m)
    return MU0 / (2.0 * math.pi * np.sqrt(q)) * (
        K + (a * a - rho * rho - z * z) / ((a - rho) ** 2 + z ** 2) * E
    )


def hand_calcs(p):
    r = {}
    r["C_T"] = p["C_each"] / p["n_series"]
    r["V"] = p["V_each"] * p["n_series"]
    r["E_C"] = 0.5 * p["C_each"] * p["V_each"] ** 2
    r["E_T"] = 0.5 * r["C_T"] * r["V"] ** 2
    r["I_bal"] = p["V_each"] / p["R_bal"]
    r["P_bal"] = p["V_each"] ** 2 / p["R_bal"]
    r["E_K_target"] = 0.5 * p["m"] * p["v_target"] ** 2
    r["eta_target"] = r["E_K_target"] / r["E_T"]

    r["V_p"] = p["m"] / p["rho_steel"]
    r["A_p"] = math.pi * p["d_p"] ** 2 / 4
    r["l_p"] = r["V_p"] / r["A_p"]
    lam = r["l_p"] / p["d_p"]
    r["lambda"] = lam
    s = math.sqrt(lam ** 2 - 1)
    r["N_d"] = (lam / s * math.log(lam + s) - 1) / (lam ** 2 - 1)
    r["mu_eff"] = p["mu_r"] / (1 + r["N_d"] * (p["mu_r"] - 1))
    r["B_s"] = p["B_sat"] / r["mu_eff"]
    r["M_s"] = p["B_sat"] / MU0

    # coil geometry
    r["N_layer"] = int(p["l_coil"] / p["d_wire_enamel"])
    r["N"] = r["N_layer"] * p["layers"]
    pitch_r = p["c_wind"] / p["layers"]
    r["layer_radii"] = [p["r_inner"] + (j + 0.5) * pitch_r for j in range(p["layers"])]
    r["a"] = p["r_inner"] + p["c_wind"] / 2
    r["OD"] = 2 * (p["r_inner"] + p["c_wind"])
    r["l_wire"] = sum(2 * math.pi * rj * r["N_layer"] for rj in r["layer_radii"])
    r["R_coil"] = r["l_wire"] * p["ohm_per_m"]
    r["R"] = r["R_coil"] + p["R_ext"]

    a, l, c, N = r["a"], p["l_coil"], p["c_wind"], r["N"]
    r["L"] = 31.5 * a ** 2 * N ** 2 / (6 * a + 9 * l + 10 * c) * 1e-6  # Wheeler, H
    r["R_crit"] = 2 * math.sqrt(r["L"] / r["C_T"])
    r["tau_L"] = r["L"] / r["R"]
    r["tau_C"] = r["R"] * r["C_T"]
    r["I_max"] = r["V"] / r["R"]

    # overdamped RLC peak (closed form)
    alpha = r["R"] / (2 * r["L"])
    w0sq = 1 / (r["L"] * r["C_T"])
    beta = math.sqrt(alpha ** 2 - w0sq)
    s1, s2 = -alpha + beta, -alpha - beta
    t_pk = math.log(s2 / s1) / (s1 - s2)
    k = r["V"] / (r["L"] * (s1 - s2))
    r["t_peak"] = t_pk
    r["I_peak"] = k * (math.exp(s1 * t_pk) - math.exp(s2 * t_pk))
    r["B_long_solenoid"] = MU0 * N * r["I_peak"] / l

    # bank bleeder (balancing resistors in parallel with it)
    r["tau_bal"] = p["n_series"] * p["R_bal"] * r["C_T"]
    r["t5_bal"] = r["tau_bal"] * math.log(r["V"] / 5)
    r["I_bleed"] = r["V"] / p["R_bleed"]
    r["P_bleed"] = r["V"] ** 2 / p["R_bleed"]
    r["tau_bleed"] = p["R_bleed"] * r["C_T"]
    r["t5_bleed"] = r["tau_bleed"] * math.log(r["V"] / 5)
    r["R_leak"] = 1 / (1 / p["R_bleed"] + 1 / (p["n_series"] * p["R_bal"]))
    r["tau_fly_diode"] = r["L"] / r["R_coil"]
    r["tau_fly"] = r["L"] / (r["R_coil"] + p["R_flyback"])

    r["m_cu"] = p["rho_cu"] * (math.pi * p["d_wire"] ** 2 / 4) * r["l_wire"]
    return r


class Field:
    """Coil field per amp, precomputed on an axial grid, averaged over the slug face."""

    def __init__(self, p, r, n_rho=24):
        self.l = p["l_coil"]
        zs_turn = (np.arange(r["N_layer"]) + 0.5) * self.l / r["N_layer"]
        # quadrature over the slug cross-section (area-weighted rings)
        Rp = p["d_p"] / 2
        edges = np.linspace(0, Rp, n_rho + 1)
        self.rho = 0.5 * (edges[1:] + edges[:-1])
        self.w = math.pi * (edges[1:] ** 2 - edges[:-1] ** 2)  # ring areas, sum = A_p
        self.A = self.w.sum()
        self.z_grid = np.linspace(-0.15, 0.15 + self.l, 6001)
        Bavg = np.zeros_like(self.z_grid)
        Baxis = np.zeros_like(self.z_grid)
        for a in r["layer_radii"]:
            for zt in zs_turn:
                dz = self.z_grid[:, None] - zt
                Bavg += (loop_Bz(a, self.rho[None, :], dz) * self.w).sum(axis=1) / self.A
                Baxis += MU0 * a * a / (2 * (a * a + (self.z_grid - zt) ** 2) ** 1.5)
        self.Bface = Bavg      # T/A, averaged over a slug-sized disc at z
        self.Baxis = Baxis     # T/A on axis
        # running integral for the volume average over the slug length
        dzg = self.z_grid[1] - self.z_grid[0]
        self.cum = np.concatenate([[0.0], np.cumsum(0.5 * (Bavg[1:] + Bavg[:-1]) * dzg)])

    def face(self, z):
        return np.interp(z, self.z_grid, self.Bface)

    def vol_avg(self, z_back, z_front):
        c = np.interp([z_back, z_front], self.z_grid, self.cum)
        return (c[1] - c[0]) / (z_front - z_back)


def simulate(p, r, fld, back_emf=False, cutoff=True, dt=1e-7, t_end=15e-3):
    l_p, A, Ms = r["l_p"], fld.A, r["M_s"]
    L, R, C = r["L"], r["R"], r["C_T"]
    z_c = 0.5 * p["l_coil"]                 # coil centre
    x = -0.5 * l_p                          # slug centre; nose at coil entrance (z = 0)
    v, q, i, t = 0.0, C * r["V"], 0.0, 0.0  # q = capacitor charge
    switch_on = True
    out = dict(t_cut=None, I_cut=None, V_end=None, v_cut=None, I_peak=0.0, t_peak=0.0,
               E_Rfb=0.0, E_coil_after=0.0)
    hist = []

    def force_per_amp(x, i):
        zb, zf = x - l_p / 2, x + l_p / 2
        Bbar = abs(i) * fld.vol_avg(zb, zf)
        M = min(Ms, r["mu_eff"] * Bbar / MU0)
        return M * A * (fld.face(zf) - fld.face(zb)), M

    while t < t_end:
        fpa, M = force_per_amp(x, i)
        F = fpa * i  # fpa = M * A * (b_front - b_back), b in T/A
        emf = fpa * v if back_emf else 0.0  # motional EMF = (dPhi/dx) v = (F/I) v
        if switch_on:
            Vc = q / C
            di = (Vc - R * i - emf) / L
            dq = -i - Vc / r["R_leak"]
        else:
            Vc = q / C
            di = (-(r["R_coil"] + p["R_flyback"]) * i - p["V_diode"] - emf) / L if i > 0 else 0.0
            dq = -Vc / r["R_leak"]
        a = F / p["m"]
        # semi-implicit Euler
        i = max(i + di * dt, 0.0) if not switch_on else i + di * dt
        q += dq * dt
        v += a * dt
        x += v * dt
        t += dt
        if not switch_on and i > 0:
            out["E_Rfb"] += i * i * p["R_flyback"] * dt
            out["E_coil_after"] += i * i * r["R_coil"] * dt
        if i > out["I_peak"]:
            out["I_peak"], out["t_peak"] = i, t
        if switch_on and cutoff and x >= z_c:
            switch_on = False
            out.update(t_cut=t, I_cut=i, V_end=q / C, v_cut=v)
        if len(hist) == 0 or t - hist[-1][0] >= 5e-5:
            hist.append((t, i, q / C, x, v))
        if not switch_on and i <= 0 and t > (out["t_cut"] or 0):
            break
        if x - l_p / 2 > p["l_coil"] + 0.05:  # slug well clear of the coil
            break
    out.update(v_final=v, t_final=t, x_final=x, hist=hist)
    if out["V_end"] is None:
        out["V_end"] = q / C
    return out


def write_sim_json(path):
    """Traces for the 3D bench: t ms, i A, vc V, x mm (slug centre), v m/s, one set per charge voltage."""
    import json
    out = {}
    for V in (40, 60, 80, 100, 120, 126):
        p = dict(P, V_each=V / P["n_series"])
        r = hand_calcs(p)
        s = simulate(p, r, Field(p, r), t_end=40e-3)
        h = s["hist"]
        out[str(V)] = dict(
            t=[round(a[0] * 1e3, 4) for a in h], i=[round(a[1], 1) for a in h], vc=[round(a[2], 2) for a in h],
            x=[round(a[3] * 1e3, 3) for a in h], v=[round(a[4], 3) for a in h],
            tcut=round(s["t_cut"] * 1e3, 3), icut=round(s["I_cut"], 1), vend=round(s["V_end"], 1),
            vcut=round(s["v_cut"], 2), vexit=round(s["v_final"], 2), ipk=round(s["I_peak"], 1),
            tpk=round(s["t_peak"] * 1e3, 3), ek=round(0.5 * p["m"] * s["v_final"] ** 2, 2),
            edrawn=round(0.5 * r["C_T"] * (r["V"] ** 2 - s["V_end"] ** 2), 1))
    json.dump(out, open(path, "w"), separators=(",", ":"))
    print("wrote", path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--back-emf", action="store_true")
    ap.add_argument("--no-cutoff", action="store_true")
    ap.add_argument("--flyback-r", type=float, default=P["R_flyback"],
                    help="ohm in series with the flyback diode (faster decay, higher switch voltage)")
    ap.add_argument("--volts", type=float, default=P["V_each"] * P["n_series"], help="bank charge voltage")
    ap.add_argument("--sim-json", help="write traces at 40-126 V for model3d (then run model3d/build.py)")
    args = ap.parse_args()
    P["R_flyback"] = args.flyback_r
    if args.sim_json:
        write_sim_json(args.sim_json)
        return
    P["V_each"] = args.volts / P["n_series"]

    r = hand_calcs(P)
    fld = Field(P, r)
    zc = 0.5 * P["l_coil"]
    B_c_per_A = float(np.interp(zc, fld.z_grid, fld.Baxis))
    B_slug_per_A = fld.vol_avg(zc - r["l_p"] / 2, zc + r["l_p"] / 2)

    print("== Hand calculations ==")
    rows = [
        ("Bank capacitance C_T", r["C_T"], "F"),
        ("Bank voltage V", r["V"], "V"),
        ("Energy per capacitor", r["E_C"], "J"),
        ("Bank energy E_T", r["E_T"], "J"),
        ("Balancing current", r["I_bal"] * 1e3, "mA"),
        ("Balancing resistor power", r["P_bal"], "W"),
        ("Target kinetic energy", r["E_K_target"], "J"),
        ("Target efficiency", r["eta_target"] * 100, "%"),
        ("Projectile volume", r["V_p"] * 1e6, "cm^3"),
        ("Projectile length", r["l_p"] * 1e3, "mm"),
        ("Aspect ratio lambda", r["lambda"], ""),
        ("Demagnetising factor N_d", r["N_d"], ""),
        ("Effective permeability", r["mu_eff"], ""),
        ("Saturating applied field B_s", r["B_s"], "T"),
        ("Saturation magnetisation M_s", r["M_s"], "A/m"),
        ("Turns per layer", r["N_layer"], ""),
        ("Total turns N", r["N"], ""),
        ("Mean radius a", r["a"] * 1e3, "mm"),
        ("Coil OD", r["OD"] * 1e3, "mm"),
        ("Wire length", r["l_wire"], "m"),
        ("Coil resistance", r["R_coil"], "ohm"),
        ("Total resistance R", r["R"], "ohm"),
        ("Inductance L (Wheeler)", r["L"] * 1e6, "uH"),
        ("Critical resistance", r["R_crit"], "ohm"),
        ("tau_L = L/R", r["tau_L"] * 1e3, "ms"),
        ("tau_C = RC", r["tau_C"] * 1e3, "ms"),
        ("Resistive current limit V/R", r["I_max"], "A"),
        ("RLC peak current", r["I_peak"], "A"),
        ("RLC time to peak", r["t_peak"] * 1e3, "ms"),
        ("B centre, long solenoid at I_peak", r["B_long_solenoid"], "T"),
        ("B centre, loop sum at I_peak", B_c_per_A * r["I_peak"], "T"),
        ("B averaged over centred slug", B_slug_per_A * 1e3, "mT/A"),
        ("Copper mass", r["m_cu"] * 1e3, "g"),
        ("Balancing pair alone: tau", r["tau_bal"], "s"),
        ("Balancing pair alone: 126 V to 5 V", r["t5_bal"] / 60, "min"),
        ("Bleeder current", r["I_bleed"], "A"),
        ("Bleeder power", r["P_bleed"], "W"),
        ("Bleeder tau", r["tau_bleed"], "s"),
        ("Bleeder: 126 V to 5 V", r["t5_bleed"] / 60, "min"),
        ("Flyback decay tau, diode only", r["tau_fly_diode"] * 1e3, "ms"),
        ("Flyback decay tau, with R_fb", r["tau_fly"] * 1e3, "ms"),
    ]
    for name, val, unit in rows:
        print(f"  {name:36s} {val:12.4g} {unit}")

    print("\n== Time-domain simulation ==")
    print(f"  back-EMF: {'on' if args.back_emf else 'off'}, cut-off: {'off' if args.no_cutoff else 'on'}")
    s = simulate(P, r, fld, back_emf=args.back_emf, cutoff=not args.no_cutoff)
    print(f"  Peak current         {s['I_peak']:8.1f} A at {s['t_peak']*1e3:.2f} ms")
    if s["t_cut"] is not None:
        E_drawn = 0.5 * r["C_T"] * (r["V"] ** 2 - s["V_end"] ** 2)
        E_k_cut = 0.5 * P["m"] * s["v_cut"] ** 2
        print(f"  Cut-off time         {s['t_cut']*1e3:8.2f} ms")
        print(f"  Current at cut-off   {s['I_cut']:8.1f} A  (coil energy {0.5*r['L']*s['I_cut']**2:.1f} J)")
        print(f"  Bank voltage at cut  {s['V_end']:8.1f} V  (energy drawn {E_drawn:.0f} J)")
        print(f"  Velocity at cut-off  {s['v_cut']:8.2f} m/s ({E_k_cut:.2f} J)")
        print(f"  Efficiency drawn     {E_k_cut/E_drawn*100:8.2f} %")
        print(f"  Efficiency total     {E_k_cut/r['E_T']*100:8.2f} %")
        dT = (E_drawn - E_k_cut) / (r["m_cu"] * P["c_cu"])
        print(f"  Coil temperature rise (upper bound) {dT:.1f} C")
        V_sw = s["V_end"] + s["I_cut"] * P["R_flyback"] + P["V_diode"]
        print(f"  Switch voltage at turn-off ~{V_sw:6.0f} V (bank + flyback path drop)")
    if s["t_cut"] is not None:
        print(f"  Flyback resistor     {s['E_Rfb']:8.2f} J per shot, peak {s['I_cut']**2*P['R_flyback']/1e3:.1f} kW")
    print(f"  Exit velocity        {s['v_final']:8.2f} m/s ({0.5*P['m']*s['v_final']**2:.2f} J, after the flyback current decays)")


if __name__ == "__main__":
    main()
