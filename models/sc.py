import csv, re, time, pathlib, requests
from bs4 import BeautifulSoup   # pip install beautifulsoup4 requests

BASE = "https://furnimesh.com/library/format/glb/plant/"  # change category, or drop "sofa/" for all
OUT = pathlib.Path("furnimesh_glb-plants"); OUT.mkdir(exist_ok=True)
MAX_PAGES = 20                                            # raise as needed
pat = re.compile(r"/gbl-files/([\w\-]+)\.glb$")
s = requests.Session(); s.headers["User-Agent"] = "Mozilla/5.0 (personal use)"

SKIP = {"GLB", "Download", "Download GLB", "Free", "3D"}


def clean(name):
    """Make a string safe to use as a Windows filename."""
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", name).strip(" .")[:100]


def get_card(a):
    """Biggest parent block that contains only this one download link."""
    card = a
    while card.parent and len(card.parent.find_all("a", href=pat)) == 1:
        card = card.parent
    return card


def find_title(a):
    card = get_card(a)
    lines = list(card.stripped_strings)
    btn = a.get_text(strip=True)
    skip = SKIP | {btn}

    # title = first real line after the truncated description (the one ending in "…")
    for i, t in enumerate(lines):
        if t.endswith(("…", "...")):
            for nxt in lines[i + 1:]:
                if nxt not in skip and "free GLB 3D model" not in nxt:
                    return nxt

    # fallback: last line that isn't a badge/button/description
    cand = [t for t in lines if t not in skip and not t.endswith(("…", "..."))]
    return cand[-1] if cand else None


seen, rows, shown = set(), [], 0

for page in range(1, MAX_PAGES + 1):
    r = s.get(BASE, params={"page": page}, timeout=30)
    soup = BeautifulSoup(r.text, "html.parser")
    new = 0

    for a in soup.find_all("a", href=pat):
        url = a["href"]
        if url in seen:
            continue
        seen.add(url)
        new += 1

        file_id = pat.search(url).group(1)
        title = find_title(a)

        if shown < 3:  # debug: check these look right
            print("TITLE FOUND:", title, "| id:", file_id)
            print("   LINES:", list(get_card(a).stripped_strings))
            shown += 1

        title = clean(title) if title else file_id
        dest = OUT / f"{title} [{file_id[:6]}].glb"

        # file already downloaded under an older name -> rename it
        old = [p for p in OUT.glob(f"*[[]{file_id[:6]}[]].glb")]
        if old and old[0] != dest:
            if dest.exists():
                old[0].unlink()
            else:
                old[0].rename(dest)
        elif not dest.exists():
            dest.write_bytes(s.get(url, timeout=60).content)
            time.sleep(1)  # be gentle

        rows.append((dest.name, title, url))

    print(f"page {page}: {new} new models")
    if not new:
        break
    time.sleep(2)

with open(OUT / "names.csv", "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows([("file", "title", "source_url"), *rows])

print(len(rows), "models")