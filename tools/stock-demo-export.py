#!/usr/bin/env python3
"""
Export a trimmed demo payload for the portfolio site's Stock
page demo (src/assets/stock-demo.json).

The source of truth is the Stock Research Assistant's own
demo mode: this script loads the app's dashboard payload via
its own load_dashboard() (which reads the latest completed
demo run from the app's SQLite store) and trims it to what
the site demo renders: run context, the ten candidates with
their five pillar scores, coverage, a curated metric set and
a 60-point price sparkline each, the sector snapshot, and
the market context strip.

Run it with the app repo's interpreter, from anywhere:

    cd ~/workspace/stock-research-assistant
    .venv/bin/python /path/to/site/tools/stock-demo-export.py

Regenerating is safe: the demo provider is deterministic.
"""
import json
import sqlite3
import sys
from pathlib import Path

APP_ROOT = Path.home() / "workspace" / "stock-research-assistant"
SITE_ROOT = Path(__file__).resolve().parents[1]
OUT = SITE_ROOT / "src" / "assets" / "stock-demo.json"

METRIC_KEYS = [
    "revenue_growth", "earnings_growth", "gross_margin",
    "profit_margin", "return_on_equity", "free_cash_flow_margin",
    "trailing_pe", "forward_pe", "peg_ratio", "price_to_sales",
    "beta", "volatility_3m", "max_drawdown_1y", "momentum_3m",
    "market_cap", "average_dollar_volume_20d", "current_ratio",
    "debt_to_equity",
]
PILLARS = ["growth", "valuation", "quality", "momentum", "risk"]


def r2(x):
    return None if x is None else round(float(x), 2)


def main():
    sys.path.insert(0, str(APP_ROOT / "src"))
    from stockrank.dashboard_data import load_dashboard

    d = load_dashboard(APP_ROOT)
    run = d["run"]
    con = sqlite3.connect(APP_ROOT / "runtime" / "stockrank.sqlite3")

    def spark(ticker):
        rows = con.execute(
            "SELECT close FROM price_bars WHERE ticker = ? "
            "ORDER BY price_date DESC LIMIT 60",
            (ticker,),
        ).fetchall()
        return [round(r[0], 2) for r in reversed(rows)]

    candidates = []
    for c in d["candidates"]:
        candidates.append({
            "ticker": c["ticker"],
            "company": c["company"],
            "sector": c["sector"],
            "rank": c["rank"],
            "price": r2(c["latest_price"]),
            "priceAsOf": c["price_as_of"],
            "score": r2(c["overall_score"]),
            "coverage": r2(c["overall_coverage"] * 100),
            "tier": c["score_tier"],
            "recommendation": c["recommendation"],
            "pillars": {p: r2(c["component_scores"][p]) for p in PILLARS},
            "pillarCoverage": {
                p: r2(c["component_coverage"][p] * 100) for p in PILLARS
            },
            "metrics": {k: c["metrics"].get(k) for k in METRIC_KEYS},
            "spark": spark(c["ticker"]),
        })

    payload = {
        "meta": {
            "freshness": d["freshness_label"],
            "asOf": run["as_of"],
            "modelVersion": run["model_version"],
            "profile": d["active"]["profile"],
            "horizon": d["active"]["horizon"],
            "risk": d["active"]["risk"],
            "universeSize": d["active"]["universe_size"],
            "universeName": d["active"]["universe_name"],
            "policy": d["policy"],
            "warning": d["warnings"][0] if d["warnings"] else "",
        },
        "candidates": candidates,
        "sectors": [
            {
                "sector": s["sector"],
                "medianReturn3m": r2(s["median_return_3m"] * 100),
                "memberCount": s["member_count"],
                "tickers": s["tickers"],
            }
            for s in d["sectors"]
        ],
        "market": [
            {
                "ticker": m["ticker"],
                "name": m["name"],
                "category": m["category"],
                "price": r2(m["price"]),
                "momentum1m": r2(m["momentum_1m"] * 100),
                "momentum3m": r2(m["momentum_3m"] * 100),
            }
            for m in d["market"]
        ],
    }
    OUT.write_text(json.dumps(payload, indent=1))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes), "
          f"{len(candidates)} candidates, run as_of {run['as_of']}")


if __name__ == "__main__":
    main()
