/*
  StockDemo (v3.48): not a recreation. The window below is
  the Stock Research Assistant's real Stock Comparison view,
  lifted from the app's own frontend and running in an
  iframe on this page, fed by a baked payload from a real
  run of the app in its demo mode (synthetic data, labeled
  inside by the app itself).

  The lifted source, the four small patches it carries, and
  the rebuild steps live in tools/stock-comparison-demo/.
  The built window is served from /demo/stock-comparison/.
*/
export default function StockDemo() {
  return (
    <section className="demo demo-wide" aria-label="Stock Research Assistant live demo">
      <h2>Live demo</h2>
      <p>
        The Stock Comparison view from the actual app, running below with its
        demo data. Pick any two of the ten candidates and compare them.
      </p>
      <div className="demo-window">
        <div className="demo-chrome" aria-hidden="true">
          <span className="demo-dots">
            <span />
            <span />
            <span />
          </span>
          <span className="demo-chrome-title">
            Stock Research Assistant · Stock Comparison
          </span>
          <span className="demo-chrome-tag">real app · demo data</span>
        </div>
        <iframe
          className="demo-frame"
          src="/demo/stock-comparison/index.html"
          title="Stock Research Assistant, Stock Comparison view, running with demo data"
          loading="lazy"
        />
      </div>
    </section>
  );
}
