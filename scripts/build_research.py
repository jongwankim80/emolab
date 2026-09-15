from pathlib import Path
from html import escape
import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "generated"
OUT.mkdir(exist_ok=True)

with (DATA / "site-content.yml").open(encoding="utf-8") as f:
    site = yaml.safe_load(f) or {}

research = site.get("research") or {}
intro = research.get("intro") or {}

icons = {
    1: "images/research/affect.png",
    2: "images/research/methods.png",
    3: "images/research/brain.png",
    4: "images/research/ai.png",
}

def txt(value):
    return escape(str(value or ""))

parts = [f'''<div class="page-intro">
  <div class="eyebrow">{txt(intro.get('eyebrow'))}</div>
  <p>{txt(intro.get('text'))}</p>
</div>''']

for i in range(1, 5):
    th = research.get(f"theme_{i}") or {}
    qlabel = th.get("questions_label") or "Questions we ask"
    parts.append(f'''<section class="research-theme">
  <div class="theme-side">
    <div class="theme-number">0{i}</div>
    <img src="{icons[i]}" alt="" class="theme-icon" aria-hidden="true">
  </div>
  <div class="theme-copy">
    <h2>{txt(th.get('title'))}</h2>
    <p>{txt(th.get('summary'))}</p>
    <p><strong>{txt(qlabel)}:</strong> {txt(th.get('questions'))}</p>
    <p><strong>Approaches:</strong> {txt(th.get('approaches'))}</p>
  </div>
</section>''')

(OUT / "research.md").write_text("\n\n".join(parts), encoding="utf-8")
print("Generated research page with fixed icon layout.")
