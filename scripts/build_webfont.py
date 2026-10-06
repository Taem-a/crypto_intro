"""Build the web-only WenKai subset; requires fonttools[woff]."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
characters = set(range(0x20, 0x100))
characters.update(range(0x370, 0x400))  # Greek letters
characters.update(range(0x2000, 0x2070))  # Punctuation
characters.update(range(0x2190, 0x2300))  # Arrows and mathematical symbols
characters.update(range(0xFF00, 0xFFF0))  # Full-width characters
# Include common Chinese text, including characters in future slide edits.
for high in range(0xA1, 0xF8):
    for low in range(0xA1, 0xFF):
        try:
            characters.update(map(ord, bytes((high, low)).decode("gb2312")))
        except UnicodeDecodeError:
            pass
for pattern in ("*.md", "components/*.vue", "pages/*.md"):
    for source in root.glob(pattern):
        characters.update(map(ord, source.read_text(encoding="utf-8")))

fonts = root / "public" / "fonts"
font = TTFont(fonts / "LXGWWenKaiScreen.ttf", recalcTimestamp=False)
characters.intersection_update(font.getBestCmap())
options = subset.Options()
options.name_IDs = ["*"]
options.name_languages = ["*"]
options.layout_features = ["*"]
options.recalc_timestamp = False
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=characters)
subsetter.subset(font)
font.flavor = "woff2"
target = fonts / "LXGWWenKaiScreen-web.woff2"
font.save(target)
print(f"Web font: {len(characters)} characters, {target.stat().st_size:,} bytes")
