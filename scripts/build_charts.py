#!/usr/bin/env python3
"""Generate the star and weekly active-user trend charts used by the README.

Outputs:
  docs/stars.svg    — star history chart (via Star History, a third-party service)
  docs/wau.svg      — weekly active-user chart (generated locally from docs/wau.json)
"""

import json
import math
import sys
from datetime import date

STAR_SVG_URL = "https://api.star-history.com/svg?repos=AideaFlow%2FAuthenticator&type=Date"
STARS_SVG_FILE = "docs/stars.svg"
WAU_JSON_FILE = "docs/wau.json"
WAU_SVG_FILE = "docs/wau.svg"

ACCENT = "#2f81f7"
GRID = "#d0d7de"
TEXT = "#24292f"
RED = "#d1242f"


def fetch_stars_svg():
    import urllib.request

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "image/svg+xml,*/*",
    }
    req = urllib.request.Request(STAR_SVG_URL, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def svg_chart(title, subtitle, points, unit, y_max=None):
    """Render a simple line chart for (week_label, value) points."""
    width, height = 800, 400
    margin = {"top": 40, "right": 24, "bottom": 48, "left": 76}
    plot_w = width - margin["left"] - margin["right"]
    plot_h = height - margin["top"] - margin["bottom"]

    values = [p["value"] for p in points]
    vmax = y_max or (max(values) if values else 0)
    vmax = max(vmax, 1)
    vmin = 0
    vrange = vmax - vmin or 1

    def x_at(i):
        return margin["left"] + (plot_w * i / max(len(points) - 1, 1))

    def y_at(v):
        return margin["top"] + plot_h - (plot_h * (v - vmin) / vrange)

    def fmt(v):
        if v >= 1000:
            s = str(v)
            return "%d,%s" % (int(s[:-3]), s[-3:]) if len(s) > 3 else s
        return str(v)

    parts = []
    parts.append('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (width, height, width, height))
    parts.append('<rect width="100%%" height="100%%" fill="#ffffff"/>')

    # title
    parts.append('<text x="%d" y="26" font-family="Segoe UI, -apple-system, sans-serif" font-size="16" font-weight="600" fill="%s">%s</text>' % (margin["left"], TEXT, title))
    if subtitle:
        parts.append('<text x="%d" y="26" text-anchor="end" font-family="Segoe UI, sans-serif" font-size="12" fill="#57606a">%s</text>' % (width - margin["right"], subtitle))

    # horizontal gridlines + labels
    steps = 4
    for i in range(steps + 1):
        v = vmin + (vrange * i / steps)
        y = y_at(v)
        parts.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s" stroke-width="1"/>' % (margin["left"], y, width - margin["right"], y, GRID))
        parts.append('<text x="%d" y="%.1f" text-anchor="end" dominant-baseline="middle" font-family="Segoe UI, sans-serif" font-size="11" fill="#57606a">%s</text>' % (margin["left"] - 8, y, fmt(int(round(v)))))

    # x labels (first, middle, last)
    if len(points) > 1:
        for idx in (0, len(points) // 2, len(points) - 1):
            label = points[idx]["label"]
            anchor = "start" if idx == 0 else ("middle" if idx == len(points) // 2 else "end")
            parts.append('<text x="%.1f" y="%d" text-anchor="%s" font-family="Segoe UI, sans-serif" font-size="11" fill="#57606a">%s</text>' % (x_at(idx), height - margin["bottom"] + 18, anchor, label))

    # line + dots
    if len(points) > 1:
        coords = ["%.1f,%.1f" % (x_at(i), y_at(p["value"])) for i, p in enumerate(points)]
        parts.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="2"/>' % (" ".join(coords), ACCENT))
        for i, p in enumerate(points):
            parts.append('<circle cx="%.1f" cy="%.1f" r="3" fill="%s"/>' % (x_at(i), y_at(p["value"]), ACCENT))
    elif points:
        parts.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>' % (x_at(0), y_at(points[0]["value"]), ACCENT))

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
    points = [{"label": s["week"], "value": s["active_install_count"]} for s in stats]
    latest = stats[-1]

    y_max = max(p["value"] for p in points)
    if len(points) >= 2:
        y_max = max(y_max, int(math.ceil(points[-1]["value"] / 100.0)) * 100)

    svg = svg_chart(
        "Weekly Active Users (Edge Add-ons)",
        "Updated weekly via GitHub Actions",
        points,
        "users",
        y_max=y_max,
    )
    if "--check" not in sys.argv:
        with open(WAU_SVG_FILE, "w", encoding="utf-8") as f:
            f.write(svg)
        print("wau.svg updated (%d points, latest %s: %d)" % (len(points), latest["week"], latest["active_install_count"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
