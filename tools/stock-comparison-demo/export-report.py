#!/usr/bin/env python3
"""
Export the demo window's data file: the full dashboard
payload of the app's latest demo run, exactly as the app's
/api/report endpoint would return it, written to
public/demo/stock-comparison/report.json.

Run with the app clone's interpreter:

    cd ~/workspace/stock-research-assistant
    .venv/bin/python /path/to/site/tools/stock-comparison-demo/export-report.py

The app must have a completed demo run stored (stockrank run
--demo). The demo provider is deterministic.
"""
import json
import sys
from pathlib import Path

APP_ROOT = Path.home() / "workspace" / "stock-research-assistant"
OUT = (Path(__file__).resolve().parents[2]
       / "public" / "demo" / "stock-comparison" / "report.json")


def main():
    sys.path.insert(0, str(APP_ROOT / "src"))
    from stockrank.dashboard_data import load_dashboard

    payload = load_dashboard(APP_ROOT)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes), "
          f"run as_of {payload['run']['as_of']}, "
          f"provider {payload['run']['provider']}")


if __name__ == "__main__":
    main()
