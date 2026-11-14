#!/usr/bin/env python3
"""Generate the star trend chart and weekly active-user badge used by the README.

Outputs:
  docs/stars.svg   — star history chart (via Star History, a third-party service)
  docs/wau.svg     — latest weekly active-user count as a bold number badge
"""

import json
import sys

STAR_SVG_URL = "https://api.star-history.com/svg?repos=AideaFlow%2FAuthenticator&type=Date"
STARS_SVG_FILE = "docs/stars.svg"
WAU_JSON_FILE = "docs/wau.json"
WAU_SVG_FILE = "docs/wau.svg"

ACCENT = "#2f81f7"
TEXT = "#24292f"
MUTED = "#57606a"
GRID = "#d0d7de"


def fetch_stars_svg():
    import urllib.request

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "image/svg+xml,*/*",
    }
    req = urllib.request.Request(STAR_SVG_URL, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def format_number(v):
    s = str(int(v))
    out = []
    for i, ch in enumerate(reversed(s)):
        if i and i % 3 == 0:
            out.append(",")
        out.append(ch)
    return "".join(reversed(out))


def wau_badge_svg(count):
    """Render the latest weekly active-user count as a simple bold badge."""
    label = "Weekly Active Users"
    value = format_number(count)

    font = 'font-family="Segoe UI, -apple-system, sans-serif"'
    lw = len(label) * 8
    vw = len(value) * 13
    width = lw + vw + 40
    height = 40
    pad = 8

    parts = []
    parts.append('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (width, height, width, height))
    parts.append('<rect width="100%%" height="100%%" fill="#f6f8fa" rx="6"/>')
    parts.append('<text x="%d" y="25" %s font-size="14" fill="%s">%s</text>' % (pad, font, MUTED, label))
    parts.append('<text x="%d" y="25" %s font-size="15" font-weight="700" fill="%s">%s</text>' % (pad + lw + 10, font, TEXT, value))
    parts.append("</svg>")
    return "".join(parts)


def main():
    if "--check" not in sys.argv:
        try:
            svg = fetch_stars_svg()
        except Exception as exc:  # noqa: BLE001 - keep last-good chart on transient failures
            print("Warning: could not fetch star history (%s); keeping existing chart" % exc)
        else:
            with open(STARS_SVG_FILE, "w", encoding="utf-8") as f:
                f.write(svg)
            print("stars.svg updated (%d bytes)" % len(svg))

    try:
        with open(WAU_JSON_FILE, "r", encoding="utf-8") as f:
            stats = json.load(f)
    except FileNotFoundError:
        stats = []

    if len(stats) < 1:
        print("WAU: no data points; skipping chart")
        if "--check" not in sys.argv:
            return 0
        return 0

    stats.sort(key=lambda s: s["week"])
    latest = stats[-1]
    count = latest["active_install_count"]

    svg = wau_badge_svg(count)
    if "--check" not in sys.argv:
        with open(WAU_SVG_FILE, "w", encoding="utf-8") as f:
            f.write(svg)
        print("wau.svg updated (latest %s: %d)" % (latest["week"], count))
    return 0


if __name__ == "__main__":
    sys.exit(main())
