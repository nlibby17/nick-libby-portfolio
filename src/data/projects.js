/*
  Central projects data file. The landing grid, the cards, and the
  detail pages all render from this one source, so featuring a
  project or reordering the lineup is an edit here, not a rebuild.
  splash: the ONE signature color allowed on that project's page.
*/
import dunkinFinal from "../assets/dunkin-final.jpg";

export const projects = [
  {
    slug: "dunkin-massachusetts",
    title: "Every Dunkin' in Massachusetts",
    cardType: "stat",
    splash: "var(--splash-dunkin)",
    featured: true,
    wide: true,
    tagline:
      "Every Dunkin' location in the state, gathered from sources that rarely agree, and resolved into one continuous route.",
    stats: [
      { value: "1,019", label: "stops" },
      { value: "2,356.9", label: "miles" },
      { value: "86.1", label: "driving hours" },
    ],
    backdrop: "sprinkles",
    video: {
      heading: "Watch",
      body: "The full route, drawn stop by stop.",
      id: "rgGDGjJWyH4",
      poster: dunkinFinal,
      label: "Watch the route video",
      posterAlt:
        "Final frame of the route video: the completed tour drawn across Massachusetts, dashboard reading 2,356.9 miles and 1,019 of 1,019 stops",
    },
    pipelineAfter: 1,
    pipeline: {
      heading: "How it was built",
      steps: [
        {
          title: "Three sources",
          body: "Locations pulled from OpenStreetMap, Overture Maps, and Dunkin's own store directory. No two sources agreed on the full set, and each had listings the others missed.",
        },
        {
          title: "Checked by hand",
          body: "Listings were compared across sources, duplicates merged, and pins checked one by one before the route was drawn. A listing only joined the route once another source confirmed it. The judgment calls were logged as they were made.",
        },
        {
          title: "The solve",
          body: "A solver (Google OR-Tools) sequenced the stops over real road distances. The result is the best tour found, not a proven optimum. A second solve, given 30 minutes, returned the same 2,356.9 miles.",
        },
        {
          title: "The render",
          body: "The finished tour, drawn stop by stop into the video at the top of this page, dashboard and all, from the same data as the route itself.",
        },
      ],
    },
    sections: [
      {
        heading: "The route",
        body: "The finished tour runs 2,356.9 miles and 86.1 driving hours across 1,019 stops. The map and the numbers above are the project. Everything else here is just how they were earned.",
      },
      {
        heading: "Code",
        body: "Data, code, and method notes live in the project repository.",
        link: {
          label: "github.com/nlibby17/dunkin-massachusetts-route",
          href: "https://github.com/nlibby17/dunkin-massachusetts-route",
        },
      },
    ],
  },
  {
    slug: "stock-research-assistant",
    title: "Stock Research Assistant",
    cardType: "tool",
    splash: "var(--splash-stock)",
    backdrop: "candles",
    demo: true,
    featured: false,
    tagline:
      "A local stock screener that ranks a customizable U.S. universe on five factors, with a scoring model you can read.",
    factors: ["Growth", "Valuation", "Quality", "Momentum", "Risk"],
    lede: "A research-only screener and ranker that runs locally and updates weekly.",
    sections: [
      {
        heading: "What it does",
        body: "The assistant reviews an explicit universe of U.S. stocks and ranks them with an interpretable scoring model built on growth, valuation, quality, momentum, and risk metrics. Scores describe a stock's relative position inside the selected universe. They are not expected returns and not investment advice.",
      },
      {
        heading: "The dashboard",
        body: "The demo above is the app's Stock Comparison view, lifted from the real frontend and running on the app's own demo data. The full app opens results in a React dashboard with five views: Home, Top Candidates, Stock Comparison, Research, and Advanced. Reports are stored in local SQLite history, so results stay reproducible and comparable over time, and any ranking can be downloaded as a CSV.",
      },
      {
        heading: "Under the hood",
        body: "Python throughout. Yahoo Finance supplies prices and screening fundamentals. SEC EDGAR supplies official company identity, filings, and Company Facts data. Missing or stale values stay visible instead of being filled in.",
      },
      {
        heading: "Code",
        body: "Source, setup guide, and full documentation live in the project repository.",
        link: {
          label: "github.com/nlibby17/Stock-Research-Assistant",
          href: "https://github.com/nlibby17/Stock-Research-Assistant",
        },
      },
    ],
  },
  {
    slug: "portal-titanfall",
    title: "Portal x Titanfall Movement Mod",
    cardType: "buildlog",
    splash: "var(--splash-portal)",
    backdrop: "portals",
    featured: false,
    status: "In progress",
    tagline:
      "Titanfall 2 pilot movement, rebuilt inside Portal's engine: sprinting, sliding, wallrunning, and double jumps in the test chambers.",
    log: [
      "Stage 1 verified: pilot speeds, gravity, jump",
      "Stage 2 verified: slide and slide-hop",
      "Stage 3 verified: wallrunning and double jump",
      "Now: tuning in a custom movement lab",
    ],
    lede: "A for-fun build run like a real project. The full v1 movement set is in the test build, and the tuning pass is under way.",
    sections: [
      {
        heading: "Status",
        body: "In progress. All three stages of the v1 movement set are implemented in a test build, and each one passed instrumented in-engine checks as it landed: base pilot movement, slide and slide-hop, then wallrunning and double jump. The work left is tuning and edge-case verification, run in a purpose-built movement lab map.",
      },
      {
        heading: "The movement set",
        body: "Titanfall pilot movement rebuilt on Portal's Source engine base, with tuning values extracted from Titanfall 2's own game files. Sprint at 260 with diagonals included, a momentum slide that boosts toward a 400 cap and chains into slide-hops, wallrunning capped at 420, a wall jump that hands back the double-jump charge, and a double jump at the same impulse as the ground jump. Grapple and Titan content stay out of scope by design.",
      },
      {
        heading: "Build log",
        body: "Oct 24, 2026: design freeze, with Stage 1 implemented the same night. Oct 25: Stage 1 and Stage 2 verified in engine, stand 173.5, sprint 260, crouch 80, slide entry at 200 and above. Oct 26: Stage 3 verified, wallrunning and double jump live in the test build, a custom movement lab compiled for playtesting, and a wall-stall bug found in testing fixed the same day. Still open: the full 1.75 second wallrun timeout check, wall trace edge cases, and the final tuning pass.",
      },
    ],
  },
];

export function getProject(slug) {
  return projects.find((p) => p.slug === slug);
}
