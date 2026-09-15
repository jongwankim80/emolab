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


parts = [f'''::: {{.page-intro}}
::: {{.eyebrow}}
{txt(intro.get('eyebrow'))}
:::

{txt(intro.get('text'))}
:::
''']

for i in range(1, 5):
    th = research.get(f"theme_{i}") or {}
    qlabel = th.get("questions_label") or "Questions we ask"
    parts.append(f''':::: {{.research-theme}}
::: {{.theme-side}}
[0{i}]{{.theme-number}}

![]({icons[i]}){{.theme-icon width="80px"}}
:::

::: {{.theme-copy}}
## {txt(th.get('title'))}

{txt(th.get('summary'))}

**{txt(qlabel)}:** {txt(th.get('questions'))}

**Approaches:** {txt(th.get('approaches'))}
:::
::::
''')

(OUT / "research.md").write_text("\n".join(parts), encoding="utf-8")
print("Generated research page with Quarto-safe icon layout.")
