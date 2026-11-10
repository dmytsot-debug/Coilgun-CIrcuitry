"""Assemble model3d/index.html from template.html + sim.json (inlined so the page is one file)."""
import os

here = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(here, "template.html"), encoding="utf-8").read()
import json
simd = json.load(open(os.path.join(here, "sim.json"), encoding="utf-8"))
sim = json.dumps(simd, separators=(",", ":"))
out = tpl.replace("/*SIM_DATA*/null", sim)
open(os.path.join(here, "index.html"), "w", encoding="utf-8").write(out)
print("wrote index.html", len(out), "bytes")
