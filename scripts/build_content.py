from pathlib import Path
from html import escape
import yaml

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


def pub_links(p):
    links = []
    doi = str(p.get('doi') or '').strip()
    if doi:
        href = doi if doi.startswith('http') else f"https://doi.org/{doi}"
        links.append(f'<a href="{escape(href)}">DOI</a>')
    for key, label in [('pdf','PDF'),('osf','OSF'),('code','Code')]:
        url = str(p.get(key) or '').strip()
        if url:
            links.append(f'<a href="{escape(url)}">{label}</a>')
    return '<span class="pub-links">' + ' · '.join(links) + '</span>' if links else ''


def publication_card(p, compact=False):
    status = str(p.get('status') or 'published').lower()
    badge = ''
    if status in {'in press', 'forthcoming'}:
        badge = f'<span class="status-badge">{escape(status.title())}</span>'
    cls = 'pub-card compact' if compact else 'pub-card'
    return f'''<article class="{cls}">
  <div class="pub-kicker">{badge}</div>
  <h3>{escape(str(p.get('title') or ''))}</h3>
  <div class="pub-authors">{author_html(str(p.get('authors') or ''))}</div>
  <div class="pub-meta">{pub_meta(p)}</div>
  {pub_links(p)}
</article>'''


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

pubs = load_yaml('publications.yml')['publications']

special = [p for p in pubs if str(p.get('status','')).lower() == 'in press']
forthcoming = [p for p in pubs if str(p.get('status','')).lower() == 'forthcoming']
published = [p for p in pubs if str(p.get('status','')).lower() == 'published']

pub_out = []
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
(OUT / 'publications.md').write_text('\n'.join(pub_out), encoding='utf-8')

featured = [p for p in pubs if p.get('featured')]
featured.sort(key=lambda p: (p.get('year') or 0, p.get('month') or 13), reverse=True)
featured = featured[:4]
home = ['<div class="featured-grid">']
home.extend(publication_card(p, compact=True) for p in featured)
home.append('</div>')
(OUT / 'home-publications.md').write_text('\n'.join(home), encoding='utf-8')

print(f'Generated {len(members)} member records and {len(pubs)} publication records.')
