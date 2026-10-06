# LXGW WenKai Screen

Font: LXGW WenKai Screen / 霞鹜文楷屏幕阅读版, v1.522.
Official release: https://github.com/lxgw/LxgwWenKai-Screen/releases/tag/v1.522
File: LXGWWenKaiScreen.ttf (unmodified).
License: SIL Open Font License 1.1; included in OFL.txt.

This font is hosted locally for slide titles and body text. Code and KaTeX math fonts are unchanged.

`LXGWWenKaiScreen-web.woff2` is a web-only subset containing common GB2312 Chinese characters, Latin/Greek text, punctuation, symbols and the current slide text. It is permitted by the additional web-delivery permission in `OFL.txt`. The original TTF is used as a fallback for uncommon characters and is no longer preloaded.

Font rules are imported through Slidev's `styles/index.css`, so the production build handles asset paths and versions the stylesheet. Regenerate the subset after adding uncommon characters:

```sh
python -m pip install "fonttools[woff]"
python scripts/build_webfont.py
```
