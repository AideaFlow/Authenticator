#!/usr/bin/env python3
"""Update weekly active-user stats for the Microsoft Edge add-on.

Polls the Edge add-on details endpoint for the current active install count
and appends a dated data point to docs/wau.json (weekly, reset each Monday).
"""

import json
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone

CRX_ID = "blmbnklhlljjokbnjjnaboppbkiikhgd"
API_URL = "https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/%s" % CRX_ID
STATS_FILE = "docs/wau.json"

USER_AGENT = "Mozilla/5.0 (compatible; Authenticator-stats/1.0; +https://github.com/AideaFlow/Authenticator)"


def fetch_active_install_count():
    req = urllib.request.Request(API_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.load(resp)
    count = data.get("activeInstallCount")
    if count is None:
        raise ValueError("activeInstallCount not found in API response")
    return int(count)


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def load_stats():
    try:
        with open(STATS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError as exc:
        print("Warning: %s is invalid JSON (%s); starting fresh" % (STATS_FILE, exc))
        return []


def save_stats(stats):
    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        # Dry run: report the would-be change without writing (used by CI).
        return 0

    today = datetime.now(timezone.utc).date()
    week = monday_of(today)

    count = fetch_active_install_count()

    stats = load_stats()
    stats = [s for s in stats if s.get("week") != week.isoformat()]
    stats.append({"week": week.isoformat(), "active_install_count": count})
    stats.sort(key=lambda s: s["week"])
    save_stats(stats)

    print("week=%s active_install_count=%s total_points=%d" % (week.isoformat(), count, len(stats)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
