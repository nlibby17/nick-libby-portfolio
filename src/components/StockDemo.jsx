import { Fragment, useMemo, useState } from "react";
import demo from "../assets/stock-demo.json";

/*
  StockDemo: the Stock page's live demo (v3.47). It mirrors
  the real app's Home view, trimmed to what a visitor needs:
  the run context strip with the app's own freshness label,
  the sector snapshot, a sortable table of the run's ten
  candidates, and a per-candidate expansion with the five
  pillar bars, data coverage, key metrics, and a price
  sparkline.

  The data is a trimmed export of a real run of the app in
  its own demo mode (tools/stock-demo-export.py): synthetic,
  deterministic, and labeled as such in the strip, exactly
  as the app labels it. Nothing here is live market data.

  Deliberately absent: the approve and override controls.
  Those belong to the app's universe updater, a different
  subsystem, and simulating them here would misrepresent
  what the dashboard does.
*/
const PILLARS = [
  ["growth", "Growth"],
  ["valuation", "Valuation"],
  ["quality", "Quality"],
  ["momentum", "Momentum"],
  ["risk", "Risk"],
];

const METRICS = [
  ["revenue_growth", "Revenue growth", "pct"],
  ["earnings_growth", "Earnings growth", "pct"],
  ["gross_margin", "Gross margin", "pct"],
  ["profit_margin", "Profit margin", "pct"],
  ["return_on_equity", "Return on equity", "pct"],
  ["trailing_pe", "Trailing P/E", "ratio"],
  ["forward_pe", "Forward P/E", "ratio"],
  ["peg_ratio", "PEG", "ratio"],
  ["beta", "Beta", "ratio"],
  ["volatility_3m", "Volatility 3m", "pct"],
  ["max_drawdown_1y", "Max drawdown 1y", "pct"],
  ["market_cap", "Market cap", "cap"],
];

const fmt = {
  pct: (v) => `${(v * 100).toFixed(1)}%`,
  ratio: (v) => v.toFixed(2),
  cap: (v) => (v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : `$${(v / 1e9).toFixed(1)}B`),
  money: (v) => `$${v.toFixed(2)}`,
  signed: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
};

function Sparkline({ points }) {
  const w = 264;
  const h = 58;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${(i * step).toFixed(1)},${(h - 5 - ((p - min) / span) * (h - 10)).toFixed(1)}`)
    .join(" ");
  return (
    <figure className="demo-spark">
      <svg viewBox={`0 0 ${w} ${h}`} role="img"
        aria-label={`Price history, ${points.length} sessions`}>
        <polyline points={d} fill="none" stroke="var(--splash-stock)"
          strokeWidth="1.6" />
      </svg>
      <figcaption>
        Last {points.length} sessions · low {fmt.money(min)} · high {fmt.money(max)}
      </figcaption>
    </figure>
  );
}

function CandidateDetail({ c }) {
  return (
    <div className="demo-detail">
      <div className="demo-pillars">
        {PILLARS.map(([key, label]) => (
          <div className="demo-pillar" key={key}>
            <span className="demo-pillar-label">{label}</span>
            <span className="demo-pillar-track">
              <span className="demo-pillar-fill"
                style={{ width: `${c.pillars[key]}%` }} />
            </span>
            <span className="demo-pillar-value">{c.pillars[key].toFixed(1)}</span>
            <span className="demo-pillar-cov">
              {c.pillarCoverage[key].toFixed(0)}% data
            </span>
          </div>
        ))}
        <p className="demo-rec">
          {c.recommendation} · overall coverage {c.coverage.toFixed(0)}%
        </p>
      </div>
      <Sparkline points={c.spark} />
      <dl className="demo-metrics">
        {METRICS.map(([key, label, kind]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{c.metrics[key] == null ? "n/a" : fmt[kind](c.metrics[key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const SORTS = {
  score: (a, b) => b.score - a.score,
  price: (a, b) => b.price - a.price,
  ticker: (a, b) => a.ticker.localeCompare(b.ticker),
};

export default function StockDemo() {
  const [sortKey, setSortKey] = useState("score");
  const [open, setOpen] = useState(demo.candidates[0]?.ticker ?? null);
  const rows = useMemo(
    () => [...demo.candidates].sort(SORTS[sortKey]),
    [sortKey],
  );
  const m = demo.meta;
  return (
    <section className="demo" aria-label="Stock Research Assistant demo">
      <h2>Live demo</h2>
      <div className="demo-context">
        <span className="demo-fresh">{m.freshness}</span>
        <span>As of {m.asOf}</span>
        <span>Model {m.modelVersion}</span>
        <span>Profile: {m.profile}</span>
        <span>Universe: {m.universeSize} stocks</span>
      </div>

      <div className="demo-sectors">
        {demo.sectors.map((s) => (
          <div className="demo-sector" key={s.sector}>
            <span className="demo-sector-name">{s.sector}</span>
            <span className={`demo-sector-ret${s.medianReturn3m < 0 ? " is-neg" : ""}`}>
              {fmt.signed(s.medianReturn3m)} median 3m
            </span>
            <span className="demo-sector-meta">
              {s.memberCount} stocks · {s.tickers.join(" ")}
            </span>
          </div>
        ))}
      </div>

      <table className="demo-table">
        <thead>
          <tr>
            <th className={sortKey === "ticker" ? "is-sorted" : ""}
              onClick={() => setSortKey("ticker")}>Ticker</th>
            <th>Company</th>
            <th>Sector</th>
            <th className={sortKey === "price" ? "is-sorted" : ""}
              onClick={() => setSortKey("price")}>Price</th>
            <th className={sortKey === "score" ? "is-sorted" : ""}
              onClick={() => setSortKey("score")}>Score</th>
            <th>Tier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <Fragment key={c.ticker}>
              <tr
                className={`demo-row${open === c.ticker ? " is-open" : ""}`}
                onClick={() => setOpen(open === c.ticker ? null : c.ticker)}>
                <td className="demo-ticker">{c.ticker}</td>
                <td>{c.company}</td>
                <td>{c.sector}</td>
                <td>{fmt.money(c.price)}</td>
                <td className="demo-score">{c.score.toFixed(1)}</td>
                <td>{c.tier}</td>
              </tr>
              {open === c.ticker && (
                <tr className="demo-detail-row">
                  <td colSpan={6}>
                    <CandidateDetail c={c} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      <div className="demo-market">
        <span className="demo-market-label">Market context</span>
        {demo.market.map((x) => (
          <span className="demo-market-item" key={`${x.category}-${x.ticker}`}>
            {x.ticker} {fmt.money(x.price)}
            <span className={x.momentum3m < 0 ? "is-neg" : "is-pos"}>
              {" "}{fmt.signed(x.momentum3m)} 3m
            </span>
          </span>
        ))}
      </div>

      <p className="demo-policy">
        Candidate policy: {m.policy}. {m.warning}. Research only.
      </p>
    </section>
  );
}
