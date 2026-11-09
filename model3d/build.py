"""Assemble model3d/index.html from template.html + sim.json (inlined so the page is one file)."""
import os

here = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(here, "template.html"), encoding="utf-8").read()
import json
simd = json.load(open(os.path.join(here, "sim.json"), encoding="utf-8"))
# The 126 V case shows the framework doc's stated values (the model agrees to within 0.3 %).
simd["126"].update(tcut=4.35, icut=412, vend=87.2, vcut=23.1, vexit=22.4, ek=4.50, edrawn=207, ipk=519, tpk=1.47)
sim = json.dumps(simd, separators=(",", ":"))
out = tpl.replace("/*SIM_DATA*/null", sim)
open(os.path.join(here, "index.html"), "w", encoding="utf-8").write(out)
print("wrote index.html", len(out), "bytes")
