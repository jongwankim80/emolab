from pathlib import Path
from datetime import datetime, timezone
import yaml
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.table import Table, TableStyleInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "publications.yml"
OUT_DIR = ROOT / "downloads"
OUT_DIR.mkdir(exist_ok=True)
OUT = OUT_DIR / "emolab-publications.xlsx"

with DATA.open(encoding="utf-8") as f:
    publications = (yaml.safe_load(f) or {}).get("publications") or []

def normalize_doi(value):
    doi = str(value or "").strip()
    for prefix in ("https://doi.org/", "http://doi.org/", "http://dx.doi.org/", "https://dx.doi.org/"):
        if doi.lower().startswith(prefix):
            return doi[len(prefix):]
    return doi

def citation_text(p):
    authors = str(p.get("authors") or "").strip()
    year = str(p.get("year") or "").strip()
    title = str(p.get("title") or "").strip()
    journal = str(p.get("journal") or "").strip()
    volume = str(p.get("volume") or "").strip()
    issue = str(p.get("issue") or "").strip()
    pages = str(p.get("pages") or "").strip()
    status = str(p.get("status") or "published").strip().lower()
    doi = normalize_doi(p.get("doi"))

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
    if status in {"in press", "forthcoming"}:
        parts.append(f"[{status.title()}].")
    if doi:
        parts.append(f"https://doi.org/{doi}")
    elif str(p.get("article_url") or "").strip():
        parts.append(str(p.get("article_url")).strip())
    return " ".join(part for part in parts if part).replace("..", ".")

wb = Workbook()
ws = wb.active
ws.title = "Publications"
ws.sheet_view.showGridLines = False
ws.freeze_panes = "A2"

headers = [
    "Year", "Month", "Status", "Category", "Authors", "Title", "Journal",
    "Volume", "Issue", "Pages", "DOI", "Article URL", "PDF", "OSF", "Code",
    "Citation"
]
ws.append(headers)

for p in publications:
    doi = normalize_doi(p.get("doi"))
    ws.append([
        p.get("year") or "",
        p.get("month") or "",
        p.get("status") or "",
        p.get("category") or "",
        p.get("authors") or "",
        p.get("title") or "",
        p.get("journal") or "",
        p.get("volume") or "",
        p.get("issue") or "",
        p.get("pages") or "",
        doi,
        p.get("article_url") or "",
        p.get("pdf") or "",
        p.get("osf") or "",
        p.get("code") or "",
        citation_text(p),
    ])

header_fill = PatternFill("solid", fgColor="245F55")
header_font = Font(color="FFFFFF", bold=True)
for cell in ws[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(vertical="center")

for row in ws.iter_rows(min_row=2):
    for cell in row:
        cell.alignment = Alignment(vertical="top", wrap_text=True)
        cell.font = Font(color="008000")

widths = {
    "A": 9, "B": 8, "C": 14, "D": 15, "E": 34, "F": 62, "G": 32,
    "H": 10, "I": 10, "J": 14, "K": 28, "L": 42, "M": 32, "N": 32,
    "O": 32, "P": 80
}
for column, width in widths.items():
    ws.column_dimensions[column].width = width

ws.row_dimensions[1].height = 24

if ws.max_row >= 2:
    table = Table(displayName="EmoLabPublications", ref=f"A1:P{ws.max_row}")
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    ws.add_table(table)

readme = wb.create_sheet("README")
readme.sheet_view.showGridLines = False
readme["A1"] = "EmoLab Publications Export"
readme["A1"].font = Font(size=16, bold=True, color="245F55")
readme["A3"] = "Source"
readme["B3"] = "https://emolab.jbnu.ac.kr/publications.html"
readme["A4"] = "Generated"
readme["B4"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
readme["A6"] = "Notes"
readme["B6"] = (
    "This workbook is generated automatically from the publication metadata "
    "used by the EmoLab website. Citation text uses the stored display-form "
    "author names and is intended as a convenient reference string."
)
readme.column_dimensions["A"].width = 18
readme.column_dimensions["B"].width = 88
for cell in ("A3", "A4", "A6"):
    readme[cell].font = Font(bold=True, color="666666")
for row in readme.iter_rows():
    for cell in row:
        cell.alignment = Alignment(vertical="top", wrap_text=True)

wb.save(OUT)
print(f"Generated {OUT} with {len(publications)} publications.")
