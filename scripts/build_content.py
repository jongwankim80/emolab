from pathlib import Path
from html import escape
import yaml
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "generated"
OUT.mkdir(exist_ok=True)


def load_yaml(name):
    with (DATA / name).open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def initials(name):
    parts = [p for p in name.replace('-', ' ').split() if p]
    return ''.join(p[0].upper() for p in parts[:2]) or '?'


def author_html(authors):
    text = escape(authors)
    for target in ("Jongwan Kim", "김종완"):
        text = text.replace(target, f"<strong>{target}</strong>")
    return text


def pub_meta(p):
    journal = escape(str(p.get('journal') or ''))
    vol = str(p.get('volume') or '').strip()
    issue = str(p.get('issue') or '').strip()
    pages = str(p.get('pages') or '').strip()
    bits = []
    if vol:
        vi = escape(vol)
        if issue:
            vi += f"({escape(issue)})"
        bits.append(vi)
    elif issue:
        bits.append(f"({escape(issue)})")
    if pages:
        bits.append(escape(pages))
    detail = ', '.join(bits)
    return f"<em>{journal}</em>{(', ' + detail) if detail else ''}"



def normalize_doi(value):
    doi = str(value or '').strip()
    for prefix in ('https://doi.org/', 'http://doi.org/', 'http://dx.doi.org/', 'https://dx.doi.org/'):
        if doi.lower().startswith(prefix):
            return doi[len(prefix):]
    return doi


def citation_text(p):
    authors = str(p.get('authors') or '').strip()
    year = str(p.get('year') or '').strip()
    title = str(p.get('title') or '').strip()
    journal = str(p.get('journal') or '').strip()
    volume = str(p.get('volume') or '').strip()
    issue = str(p.get('issue') or '').strip()
    pages = str(p.get('pages') or '').strip()
    status = str(p.get('status') or 'published').strip().lower()
    doi = normalize_doi(p.get('doi'))

    journal_bits = journal
    if volume:
        journal_bits += f", {volume}"
        if issue:
            journal_bits += f"({issue})"
    elif issue:
        journal_bits += f", ({issue})"
    if pages:
        journal_bits += f", {pages}"

    parts = [f"{authors}. ({year}). {title}. {journal_bits}."]
    if status in {'in press', 'forthcoming'}:
        parts.append(f"[{status.title()}].")
    if doi:
        parts.append(f"https://doi.org/{doi}")
    elif str(p.get('article_url') or '').strip():
        parts.append(str(p.get('article_url')).strip())
    return ' '.join(part for part in parts if part).replace('..', '.')


def bibtex_text(p):
    authors = str(p.get('authors') or '').strip()
    bib_authors = re.sub(r'\s*,\s*&\s*|\s*&\s*|\s*,\s*', ' and ', authors)
    title = str(p.get('title') or '').strip()
    year = str(p.get('year') or '').strip()
    journal = str(p.get('journal') or '').strip()
    volume = str(p.get('volume') or '').strip()
    issue = str(p.get('issue') or '').strip()
    pages = str(p.get('pages') or '').strip()
    doi = normalize_doi(p.get('doi'))
    article_url = str(p.get('article_url') or '').strip()

    digest = hashlib.sha1((title + '|' + year).encode('utf-8')).hexdigest()[:8]
    key = f"emolab{year}{digest}"

    fields = [
        ('author', bib_authors),
        ('title', title),
        ('journal', journal),
        ('year', year),
    ]
    if volume:
        fields.append(('volume', volume))
    if issue:
        fields.append(('number', issue))
    if pages:
        fields.append(('pages', pages))
    if doi:
        fields.append(('doi', doi))
        fields.append(('url', f"https://doi.org/{doi}"))
    elif article_url:
        fields.append(('url', article_url))

    lines = [f"@article{{{key},"]
    for index, (name, value) in enumerate(fields):
        comma = ',' if index < len(fields) - 1 else ''
        lines.append(f"  {name} = {{{value}}}{comma}")
    lines.append("}")
    return '\n'.join(lines)


def citation_actions(p):
    citation = escape(citation_text(p), quote=True)
    bibtex = escape(bibtex_text(p), quote=True)
    return (
        '<div class="pub-citation-actions">'
        f'<button type="button" class="pub-copy-btn pub-copy-citation" data-copy-kind="citation" data-copy-text="{citation}">'
        '<span class="pub-copy-icon" aria-hidden="true">'
        '<svg viewBox="0 0 24 24" focusable="false"><path d="M8 7.5V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1.5M7 8h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/></svg>'
        '</span>'
        '<span class="pub-copy-label">Copy citation</span>'
        '</button>'
        f'<button type="button" class="pub-copy-btn pub-copy-bibtex" data-copy-kind="bibtex" data-copy-text="{bibtex}">'
        '<span class="pub-copy-icon pub-copy-code" aria-hidden="true">{ }</span>'
        '<span class="pub-copy-label">BibTeX</span>'
        '</button>'
        '<span class="pub-copy-status" aria-live="polite"></span>'
        '</div>'
    )


def pub_links(p, compact=False):
    links = []
    doi = str(p.get('doi') or '').strip()
    if doi:
        href = doi if doi.startswith('http') else f"https://doi.org/{doi}"
        links.append(f'<a href="{escape(href)}">DOI</a>')
    if not compact:
        atlas = str(p.get('atlas') or '').strip()
        if atlas:
            links.append(f'<a class="pub-atlas-link" href="{escape(atlas)}">Interactive Atlas</a>')
    for key, label in [('article_url','Article'),('pdf','PDF'),('osf','OSF'),('code','Code')]:
        url = str(p.get(key) or '').strip()
        if url:
            links.append(f'<a href="{escape(url)}">{label}</a>')
    return '<span class="pub-links">' + ' · '.join(links) + '</span>' if links else ''


PUB_THEME_ICONS = {
    'affect': ('images/research/affect.png', 'Affective Representation'),
    'methods': ('images/research/methods.png', 'Multivariate Methods'),
    'brain': ('images/research/brain.png', 'Brain & Physiology'),
    'ai': ('images/research/ai.png', 'Humans & Artificial Intelligence'),
    'etc': ('images/research/etc.svg', 'Etc'),
}


def publication_card(p, compact=False):
    status = str(p.get('status') or 'published').lower()
    badge = ''
    if status in {'in press', 'forthcoming'}:
        badge = f'<span class="status-badge">{escape(status.title())}</span>'

    theme = str(p.get('category') or 'etc').strip().lower()
    icon_html = ''
    if not compact and theme in PUB_THEME_ICONS:
        icon_path, icon_label = PUB_THEME_ICONS[theme]
        icon_html = (
            f'<div class="pub-theme-icon">'
            f'<img src="{escape(icon_path)}" alt="{escape(icon_label)}">'
            f'</div>'
        )

    cls = 'pub-card compact' if compact else 'pub-card'
    card_attrs = ''
    if not compact:
        card_attrs = (
            f' data-category="{escape(theme, quote=True)}"'
            f' data-year="{escape(str(p.get("year") or ""), quote=True)}"'
        )
    return (
        f'<article class="{cls}"{card_attrs}>'
        f'{icon_html}'
        f'<div class="pub-card-body">'
        f'<div class="pub-kicker">{badge}</div>'
        f'<h3>{escape(str(p.get("title") or ""))}</h3>'
        f'<div class="pub-authors">{author_html(str(p.get("authors") or ""))}</div>'
        f'<div class="pub-meta">{pub_meta(p)}</div>'
        f'{pub_links(p, compact=compact)}'
        f'{citation_actions(p) if not compact else ""}'
        f'</div>'
        f'</article>'
    )


def txt(value):
    return escape(str(value or ''))


# People
members = load_yaml('members.yml')['members']
pi = next(m for m in members if m.get('group') == 'pi')
undergrads = [m for m in members if m.get('group') == 'undergraduate' and m.get('current')]
grads = [m for m in members if m.get('group') == 'graduate' and m.get('current')]
alumni = [m for m in members if m.get('group') == 'alumni']

people = []
people.append('<section class="pi-profile">')
people.append(f'<div class="pi-photo"><img src="{escape(pi.get("photo", ""))}" alt="Portrait of {escape(pi["name"])}"></div>')
people.append('<div class="pi-copy">')
people.append('<div class="eyebrow">Principal Investigator</div>')
people.append(f'<h2>{escape(pi["name"])} <span class="ko-name">{escape(pi.get("name_ko", ""))}</span></h2>')
people.append(f'<p class="pi-title">{escape(pi.get("current_position", ""))}</p>')
people.append(f'<p>{escape(pi.get("research", ""))}</p>')
people.append('<div class="profile-links">')
people.append('<a href="https://scholar.google.com/citations?user=xs8AkecAAAAJ&hl=en">Google Scholar</a>')
people.append('<a href="https://orcid.org/0000-0003-1316-1041">ORCID</a>')
people.append(f'<a href="mailto:{escape(pi.get("email", ""))}">Email</a>')
people.append('</div>')
people.append('</div></section>')

if grads:
    people.append('<section class="people-section"><div class="section-heading"><span class="eyebrow">Team</span><h2>Graduate Students</h2></div><div class="people-grid">')
    for m in grads:
        people.append(f'<article class="person-card"><div class="avatar-fallback">{initials(m["name"])}</div><h3>{escape(m["name"])}</h3><div class="ko-name">{escape(m.get("name_ko", ""))}</div><p>{escape(m.get("role", ""))}</p></article>')
    people.append('</div></section>')

people.append('<section class="people-section"><div class="section-heading"><span class="eyebrow">Team</span><h2>Undergraduate Researchers</h2></div><div class="people-grid">')
for m in undergrads:
    people.append(f'<article class="person-card"><div class="avatar-fallback">{initials(m["name"])}</div><h3>{escape(m["name"])}</h3><div class="ko-name">{escape(m.get("name_ko", ""))}</div><p>{escape(m.get("year", ""))} · {escape(m.get("role", ""))}</p></article>')
people.append('</div></section>')

people.append('<section class="people-section alumni-section"><div class="section-heading"><span class="eyebrow">Former members</span><h2>Alumni</h2></div><div class="alumni-list">')
for m in sorted(alumni, key=lambda x: str(x.get('year','')), reverse=True):
    detail = ' · '.join(x for x in [str(m.get('degree') or ''), str(m.get('year') or ''), str(m.get('current_position') or '')] if x)
    people.append(f'<div class="alumni-row"><div><strong>{escape(m["name"])}</strong> <span class="ko-name">{escape(m.get("name_ko", ""))}</span></div><div>{escape(detail)}</div></div>')
people.append('</div></section>')
(OUT / 'people.md').write_text('\n'.join(people), encoding='utf-8')


# Publications
pubs = load_yaml('publications.yml')['publications']
special = [p for p in pubs if str(p.get('status','')).lower() == 'in press']
forthcoming = [p for p in pubs if str(p.get('status','')).lower() == 'forthcoming']
published = [p for p in pubs if str(p.get('status','')).lower() == 'published']

pub_years = sorted({str(p.get('year')) for p in pubs if p.get('year')}, reverse=True)
year_options = ''.join(
    f'<option value="{escape(year)}">{escape(year)}</option>'
    for year in pub_years
)

pub_out = [
    '<section class="publication-tools" aria-label="Publication filters">',
    '<div class="pub-tool-top">',
    '<div class="pub-control pub-search-control">',
    '<label for="publication-search">Search publications</label>',
    '<input id="publication-search" class="pub-search-input" type="search" autocomplete="off" placeholder="Search title, author, or journal...">',
    '</div>',
    '<div class="pub-control">',
    '<label for="publication-year">Year</label>',
    f'<select id="publication-year" class="pub-year-select"><option value="all">All years</option>{year_options}</select>',
    '</div>',
    '<div class="pub-tool-actions">',
    '<button class="pub-reset" id="publication-reset" type="button">Reset</button>',
    '<a class="pub-download" href="downloads/emolab-publications.xlsx" download>Download Excel</a>',
    '</div>',
    '</div>',
    '<div class="pub-filter-chips" role="group" aria-label="Research theme">',
    '<button class="pub-filter-chip" type="button" data-pub-category="all" aria-pressed="true">All</button>',
    '<button class="pub-filter-chip" type="button" data-pub-category="affect" aria-pressed="false">Affective Representation</button>',
    '<button class="pub-filter-chip" type="button" data-pub-category="methods" aria-pressed="false">Multivariate Methods</button>',
    '<button class="pub-filter-chip" type="button" data-pub-category="brain" aria-pressed="false">Brain &amp; Physiology</button>',
    '<button class="pub-filter-chip" type="button" data-pub-category="ai" aria-pressed="false">Humans &amp; AI</button>',
    '<button class="pub-filter-chip" type="button" data-pub-category="etc" aria-pressed="false">Other</button>',
    '</div>',
    f'<div class="pub-tool-footer"><span id="publication-count" aria-live="polite">Showing {len(pubs)} publications</span></div>',
    '</section>',
]
if special:
    pub_out.append('<section class="pub-year"><div class="year-label">In press</div>')
    pub_out.extend(publication_card(p) for p in special)
    pub_out.append('</section>')
if forthcoming:
    pub_out.append('<section class="pub-year"><div class="year-label">Forthcoming</div>')
    pub_out.extend(publication_card(p) for p in forthcoming)
    pub_out.append('</section>')
for year in sorted({p['year'] for p in published if p.get('year')}, reverse=True):
    pub_out.append(f'<section class="pub-year"><div class="year-label">{year}</div>')
    year_pubs = [p for p in published if p.get('year') == year]
    year_pubs.sort(key=lambda p: (p.get('month') or 0), reverse=True)
    pub_out.extend(publication_card(p) for p in year_pubs)
    pub_out.append('</section>')
pub_out.append('<p class="pub-no-results" id="publication-no-results" hidden>No publications match the current filters.</p>')
(OUT / 'publications.md').write_text('\n'.join(pub_out), encoding='utf-8')

featured = [p for p in pubs if p.get('featured')]
featured.sort(key=lambda p: (p.get('year') or 0, p.get('month') or 13), reverse=True)
featured = featured[:4]
home_pubs = ['<div class="featured-grid">']
home_pubs.extend(publication_card(p, compact=True) for p in featured)
home_pubs.append('</div>')
(OUT / 'home-publications.md').write_text('\n'.join(home_pubs), encoding='utf-8')


# CMS-editable site text
site = load_yaml('site-content.yml')

h = site['home']
r = h['research_section']
s = h['selected_work']
t = h['team']
hero = h['hero']
home_body = f'''::: {{.hero-wrap}}
::: {{.hero-inner}}
::: {{.hero-copy}}
::: {{.eyebrow}}
{txt(hero['eyebrow'])}
:::

# {txt(hero['title_before_highlight'])} [**{txt(hero['title_highlight'])}**]{{.hero-highlight}}

{txt(hero['intro'])}

::: {{.hero-actions}}
[{txt(hero['primary_button'])}](research.qmd){{.btn .btn-primary}}
[{txt(hero['secondary_button'])}](people.qmd){{.btn .btn-outline-primary}}
:::
:::

::: {{.hero-visual aria-hidden="true"}}
::: {{.orbit .orbit-a}}
:::
::: {{.orbit .orbit-b}}
:::
::: {{.map-node .node-affect}}
Affect
:::
::: {{.map-node .node-brain}}
Brain
:::
::: {{.map-node .node-methods}}
Methods
:::
::: {{.map-node .node-ai}}
AI
:::
::: {{.map-center}}
EmoLab
:::
:::
:::
:::

::: {{.content-section}}
::: {{.section-heading}}
::: {{.eyebrow}}
{txt(r['eyebrow'])}
:::
## {txt(r['heading'])}

{txt(r['intro'])}
:::

::: {{.grid}}
::: {{.g-col-12 .g-col-md-6 .research-card}}
<div class="card-index">01</div>
### {txt(r['theme_1_title'])}
{txt(r['theme_1_text'])}
:::
::: {{.g-col-12 .g-col-md-6 .research-card}}
<div class="card-index">02</div>
### {txt(r['theme_2_title'])}
{txt(r['theme_2_text'])}
:::
::: {{.g-col-12 .g-col-md-6 .research-card}}
<div class="card-index">03</div>
### {txt(r['theme_3_title'])}
{txt(r['theme_3_text'])}
:::
::: {{.g-col-12 .g-col-md-6 .research-card}}
<div class="card-index">04</div>
### {txt(r['theme_4_title'])}
{txt(r['theme_4_text'])}
:::
:::
:::

::: {{.content-section .selected-work}}
::: {{.section-heading .split-heading}}
::: {{}}
::: {{.eyebrow}}
{txt(s['eyebrow'])}
:::
## {txt(s['heading'])}
:::
[{txt(s['link_text'])}](publications.qmd){{.text-link}}
:::

{{{{< include generated/home-publications.md >}}}}
:::

::: {{.team-callout}}
::: {{}}
::: {{.eyebrow}}
{txt(t['eyebrow'])}
:::
## {txt(t['heading'])}

{txt(t['intro'])}
:::
[{txt(t['button_text'])}](people.qmd){{.btn .btn-outline-primary}}
:::
'''
(OUT / 'home.md').write_text(home_body, encoding='utf-8')

research = site['research']
research_parts = [f'''::: {{.page-intro}}
::: {{.eyebrow}}
{txt(research['intro']['eyebrow'])}
:::
{txt(research['intro']['text'])}
:::
''']

theme_icons = {
    1: "images/research/affect.png",
    2: "images/research/methods.png",
    3: "images/research/brain.png",
    4: "images/research/ai.png",
}

for i in range(1, 5):
    th = research[f'theme_{i}']
    qlabel = th.get('questions_label') or 'Questions we ask'
    research_parts.append(f'''::: {{.research-theme}}
::: {{.theme-side}}
::: {{.theme-number}}
0{i}
:::
<img src="{theme_icons[i]}" alt="" class="theme-icon" aria-hidden="true">
:::
::: {{.theme-copy}}
## {txt(th['title'])}

{txt(th['summary'])}

**{txt(qlabel)}:** {txt(th['questions'])}

**Approaches:** {txt(th['approaches'])}

:::
:::
''')
(OUT / 'research.md').write_text('\n'.join(research_parts), encoding='utf-8')

resources = site['resources']
resources_body = f'''::: {{.page-intro}}
::: {{.eyebrow}}
{txt(resources['intro']['eyebrow'])}
:::
{txt(resources['intro']['text'])}
:::

::: {{.resource-grid}}
::: {{.resource-card}}
### {txt(resources['methods']['title'])}
{txt(resources['methods']['text'])}
:::
::: {{.resource-card}}
### {txt(resources['data']['title'])}
{txt(resources['data']['text'])}
:::
::: {{.resource-card}}
### {txt(resources['profiles']['title'])}
[Google Scholar](https://scholar.google.com/citations?user=xs8AkecAAAAJ&hl=en) · [ORCID](https://orcid.org/0000-0003-1316-1041) · [GitHub](https://github.com/jongwankim80)
:::
:::

::: {{.small-note .resource-note}}
{txt(resources['note'])}
:::
'''
(OUT / 'resources.md').write_text(resources_body, encoding='utf-8')

join = site['join']
grad_status = join['graduate'].get('status') or 'Open'
grad_status_key = join['graduate'].get('status_key') or 'open'
ug_status = join['undergraduate'].get('status') or 'Inquiries welcome'
ug_status_key = join['undergraduate'].get('status_key') or 'inquiry'

join_body = f'''::: {{.page-intro}}
::: {{.eyebrow}}
{txt(join['intro']['eyebrow'])}
:::
{txt(join['intro']['text'])}
:::

<div class="recruitment-status" aria-label="Current recruitment status">
  <div class="recruitment-status-head">
    <span class="recruitment-status-kicker">Current opportunities</span>
    <span class="recruitment-status-note">Recruitment status</span>
  </div>
  <div class="recruitment-status-grid">
    <div class="recruitment-status-item">
      <div>
        <span class="recruitment-status-label">Graduate students</span>
        <span class="recruitment-status-sub">Prospective graduate study</span>
      </div>
      <span class="recruitment-badge recruitment-{txt(grad_status_key)}"><span class="recruitment-dot" aria-hidden="true"></span>{txt(grad_status)}</span>
    </div>
    <div class="recruitment-status-item">
      <div>
        <span class="recruitment-status-label">Undergraduate researchers</span>
        <span class="recruitment-status-sub">JBNU research participation</span>
      </div>
      <span class="recruitment-badge recruitment-{txt(ug_status_key)}"><span class="recruitment-dot" aria-hidden="true"></span>{txt(ug_status)}</span>
    </div>
  </div>
</div>

::: {{.join-grid}}
::: {{.join-card}}
<span class="join-card-status recruitment-badge recruitment-{txt(grad_status_key)}"><span class="recruitment-dot" aria-hidden="true"></span>{txt(grad_status)}</span>

## {txt(join['graduate']['title'])}
{txt(join['graduate']['text'])}

{txt(join['graduate']['contact_text'])} **{txt(join['contact']['email'])}**.
:::
::: {{.join-card}}
<span class="join-card-status recruitment-badge recruitment-{txt(ug_status_key)}"><span class="recruitment-dot" aria-hidden="true"></span>{txt(ug_status)}</span>

## {txt(join['undergraduate']['title'])}
{txt(join['undergraduate']['text'])}

{txt(join['undergraduate']['contact_text'])}
:::
:::

## {txt(join['contact']['heading'])}

**{txt(join['contact']['name'])}**  
{txt(join['contact']['title'])}  
{txt(join['contact']['university'])}  
{txt(join['contact']['office'])}  
{txt(join['contact']['location'])}  
[{txt(join['contact']['email'])}](mailto:{txt(join['contact']['email'])}) · {txt(join['contact']['phone'])}
'''
(OUT / 'join.md').write_text(join_body, encoding='utf-8')

print(f'Generated {len(members)} member records, {len(pubs)} publication records, and CMS-editable site text.')
