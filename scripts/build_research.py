from pathlib import Path
from html import escape
import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "generated"
OUT.mkdir(exist_ok=True)

with (DATA / "site-content.yml").open(encoding="utf-8") as f:
    site = yaml.safe_load(f) or {}

with (DATA / "publications.yml").open(encoding="utf-8") as f:
    publications = (yaml.safe_load(f) or {}).get("publications") or []

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

categories = {
    1: "affect",
    2: "methods",
    3: "brain",
    4: "ai",
}


def txt(value):
    return escape(str(value or ""))


def author_html(authors):
    text = escape(str(authors or ""))
    for target in ("Jongwan Kim", "김종완"):
        text = text.replace(target, f"<strong>{target}</strong>")
    return text


def publication_url(pub):
    doi = str(pub.get("doi") or "").strip()
    if doi:
        return doi if doi.startswith("http") else f"https://doi.org/{doi}"
    return str(pub.get("article_url") or "").strip()


def publication_item(pub, index):
    title = txt(pub.get("title"))
    href = publication_url(pub)
    title_html = f'<a href="{escape(href, quote=True)}">{title}</a>' if href else title
    status = str(pub.get("status") or "published").strip().lower()
    status_text = f' · {escape(status.title())}' if status in {"in press", "forthcoming"} else ""
    return (
        '<article class="research-pub-item">'
        f'<div class="research-pub-index">{index:02d}</div>'
        '<div class="research-pub-copy">'
        f'<div class="research-pub-title">{title_html}</div>'
        f'<div class="research-pub-meta">{author_html(pub.get("authors"))} · '
        f'<em>{txt(pub.get("journal"))}</em> · {txt(pub.get("year"))}{status_text}</div>'
        '</div>'
        '</article>'
    )


def selected_publications(category):
    eligible = [
        pub for pub in publications
        if str(pub.get("category") or "").strip().lower() == category
        and str(pub.get("status") or "published").strip().lower()
        in {"published", "in press", "forthcoming"}
    ]
    eligible.sort(
        key=lambda pub: (
            int(pub.get("year") or 0),
            13 if str(pub.get("status") or "").strip().lower()
            in {"in press", "forthcoming"}
            else int(pub.get("month") or 0),
        ),
        reverse=True,
    )
    return eligible[:3]


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

    related = selected_publications(categories[i])
    publications_block = ""
    if related:
        items = "".join(
            publication_item(pub, index)
            for index, pub in enumerate(related, start=1)
        )
        publications_block = (
            '<div class="research-publications">'
            '<div class="research-publications-head">'
            '<h3>Selected publications</h3>'
            '<a href="publications.html">View all publications →</a>'
            '</div>'
            f'<div class="research-pub-list">{items}</div>'
            '</div>'
        )

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
{publications_block}
:::
::::
''')

(OUT / "research.md").write_text("\n".join(parts), encoding="utf-8")
print("Generated research page with Quarto-safe icon layout.")
