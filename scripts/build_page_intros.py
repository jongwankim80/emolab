from pathlib import Path
from html import escape
import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "generated"
OUT.mkdir(exist_ok=True)

with (DATA / "site-content.yml").open(encoding="utf-8") as f:
    site = yaml.safe_load(f) or {}


def txt(value):
    return escape(str(value or ""))

people = site.get("people_page") or {}
people_intro = people.get("intro") or {}
people_md = f'''::: {{.page-intro}}
::: {{.eyebrow}}
{txt(people_intro.get('eyebrow'))}
:::

{txt(people_intro.get('text'))}
:::
'''
(OUT / "people-intro.md").write_text(people_md, encoding="utf-8")

pubs = site.get("publications_page") or {}
pub_intro = pubs.get("intro") or {}
link_url = str(pub_intro.get("link_url") or "").strip()
link_text = txt(pub_intro.get("link_text") or "")
note_before = txt(pub_intro.get("note_before_link") or "")
if link_url and link_text:
    note_line = f'{note_before} [{link_text}]({escape(link_url)}).'
else:
    note_line = note_before

pub_md = f'''::: {{.page-intro .publications-intro}}
::: {{.eyebrow}}
{txt(pub_intro.get('eyebrow'))}
:::

{txt(pub_intro.get('text'))}

::: {{.small-note}}
{note_line}
:::
:::
'''
(OUT / "publications-intro.md").write_text(pub_md, encoding="utf-8")

print("Generated CMS-driven People and Publications intros.")
