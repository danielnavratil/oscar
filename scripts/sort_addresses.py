#!/usr/bin/env python3
"""Split a magazine address list into the two printer files (HH and KOPA).

Each subscriber's `country` (an ISO-style abbreviation) is looked up in the
production-zones table, which assigns a printer, canonical country name and
region. The zone columns are appended and the list is split by printer.

Row order is preserved exactly as it appears in the address list — the printers
expect the order the list was exported in, not a re-sort.

Usage:
  sort_addresses.py <address-list.csv> <out-prefix> [--zones <zones.csv>]

Example:
  sort_addresses.py "Magazine Address List - September 1, 2026.csv" "Issue 42/MJ42"
  → "Issue 42/MJ42_HH.csv" and "Issue 42/MJ42_KOPA.csv"
"""
import csv, sys, os
from collections import Counter

ZONES_DEFAULT = ("/Users/daniel/Documents/Creative/Asimov/Midjourney/Resources/"
                 "MJ 2024 Production Zones - ZONES.csv")
# matches the Issue 40 output exactly (pandas merge suffixes: country_x = list, country_y = zone)
OUT_COLS = ["subscription_id", "email", "name", "line1", "line2", "city", "state",
            "postal_code", "country_x", "printer", "country_y", "abbreviation", "region"]


def read_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def load_zones(path):
    """abbreviation -> zone row. First match wins: FR is listed twice
    (France / France, Metropolitan) and Issue 40 used the first."""
    zones = {}
    for z in read_csv(path):
        zones.setdefault(z["Abbreviation"].strip(), z)
    return zones


def main():
    args = [a for a in sys.argv[1:]]
    zones_path = ZONES_DEFAULT
    if "--zones" in args:
        i = args.index("--zones")
        zones_path = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    list_path, prefix = args

    zones = load_zones(zones_path)
    rows = read_csv(list_path)

    out = {"HH": [], "KOPA": []}
    unmatched = []
    for r in rows:
        code = (r.get("country") or "").strip()
        z = zones.get(code)
        if not z:
            unmatched.append(r)
            continue
        rec = {c: r.get(c, "") for c in OUT_COLS if c in r}
        rec["country_x"] = code
        rec["printer"] = z["Printer"].strip()
        rec["country_y"] = z["Country"]
        rec["abbreviation"] = z["Abbreviation"].strip()
        rec["region"] = z["Region"]
        out.setdefault(rec["printer"], []).append(rec)

    for printer, recs in out.items():
        path = f"{prefix}_{printer}.csv"
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=OUT_COLS)
            w.writeheader()
            w.writerows(recs)
        by_region = Counter(x["region"] for x in recs)
        print(f"{os.path.basename(path)}: {len(recs)} addresses, "
              f"{len({x['country_y'] for x in recs})} countries")
        for region, n in by_region.most_common():
            print(f"    {region}: {n}")

    if unmatched:
        path = f"{prefix}_UNMATCHED.csv"
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(unmatched)
        codes = Counter((r.get("country") or "(blank)").strip() for r in unmatched)
        print(f"\n!! {len(unmatched)} addresses had no production zone -> "
              f"{os.path.basename(path)}: {dict(codes)}")

    total = sum(len(v) for v in out.values()) + len(unmatched)
    print(f"\ninput {len(rows)} addresses -> output {total} "
          f"({'balanced' if total == len(rows) else 'MISMATCH'})")


if __name__ == "__main__":
    main()
