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
atlas = research.get("atlas") or {}
atlas_ai = research.get("atlas_ai") or {}

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
    atlas_block = ""
    active_atlas = atlas if i == 1 else atlas_ai if i == 4 else {}
    if active_atlas.get("url"):
        atlas_block = f"""
::: {{.atlas-feature}}
::: {{.atlas-feature-kicker}}
{txt(active_atlas.get('eyebrow'))}
:::
### {txt(active_atlas.get('title'))}

{txt(active_atlas.get('text'))}

[{txt(active_atlas.get('link_text'))}]({txt(active_atlas.get('url'))}){{.atlas-feature-link}}
:::
"""
    parts.append(f''':::: {{.research-theme}}
::: {{.theme-side}}
[0{i}]{{.theme-number}}

![]({icons[i]}){{.theme-icon width="140px"}}
:::

::: {{.theme-copy}}
## {txt(th.get('title'))}

{txt(th.get('summary'))}

**{txt(qlabel)}:** {txt(th.get('questions'))}

**Approaches:** {txt(th.get('approaches'))}

{atlas_block}
:::
::::
''')

(OUT / "research.md").write_text("\n".join(parts), encoding="utf-8")
print("Generated research page with Quarto-safe icon layout.")
