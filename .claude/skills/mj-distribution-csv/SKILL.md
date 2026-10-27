---
name: mj-distribution-csv
description: Prepares the Midjourney magazine mailing files — the free/gift distribution list in Daniel's required CSV format (split first/last name, blank third header, Windows-1252, CRLF) with duplicate and encoding checks, and the subscriber address list split into the two printer files (MJNN_HH.csv / MJNN_KOPA.csv). Use it when Daniel mentions a distribution file, distribution list, gift/free copies list, address list, mailing list, printer CSVs, or drops a CSV of recipients or subscribers.
---

# Distribution and address lists

Two different files; keep them apart.

## Free / gift distribution list (`Issue NN/MJNN_Distribution.csv`)

Format (from Oct 2026; Daniel's corrected MJ42 file is the model):
- Header, 11 columns, exactly: `Quantity,Name,,Organization,Line1,Line2,City,State,Postal_Code,Country Code,Email` (the third header is intentionally empty).
- Column 2 = first name, column 3 = last name. Multi-word surnames stay together in column 3 ("Van Dyke", "do Prado"); single names leave column 3 empty.
- No Description column (older lists had one; older lists also had one combined Name column).
- Saved like Excel's "CSV (Comma delimited)": Windows-1252 encoding, CRLF line endings, fields quoted only when they contain a comma. Windows-1252 can't hold Korean, Chinese, Arabic etc.: list any such rows for Daniel instead of letting them turn into "?". Check the output by decoding it as cp1252.
- Quantity per row (6 is typical for schools/organisations; Midjourney HQ gets a large number).

Always check and report, without deleting anything:
- the same recipient twice (same person, or same address with lines swapped or a different org name): six duplicates shipped twice in the MJ42 list;
- missing country code, postal code or city;
- country written out where a code is expected ("United Kingdom", "USA") — flag, Daniel decides.

## Subscriber address list → printer files

`python3 /Users/daniel/Code/oscar-v1/scripts/sort_addresses.py "<address list>.csv" "Issue NN/MJNN"` looks up each subscriber's country in the production-zones table (`Resources/MJ 2024 Production Zones - ZONES.csv`), appends printer/country/region and writes `MJNN_HH.csv` and `MJNN_KOPA.csv` with the original row order kept (the printers want export order). Report unmatched countries.

Whether the distribution format above also applies to these subscriber files is unconfirmed: ask Daniel before converting them.
