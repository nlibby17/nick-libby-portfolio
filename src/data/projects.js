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
    lede: "One state, every store, one route.",
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
        body: "The finished tour runs 2,356.9 miles and 86.1 driving hours across 1,019 stops. The map and the numbers above are the project; everything else here is just how they were earned.",
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
    featured: false,
    tagline:
      "A local stock screener that ranks a customizable U.S. universe on five factors, with a scoring model you can read.",
    factors: ["Growth", "Valuation", "Quality", "Momentum", "Risk"],
    lede: "A research-only screener and ranker. It runs locally, shows its work, and places no trades.",
    sections: [
      {
        heading: "What it does",
        body: "The assistant reviews an explicit universe of U.S. stocks and ranks them with an interpretable scoring model built on growth, valuation, quality, momentum, and risk metrics. Scores describe a stock's relative position inside the selected universe. They are not expected returns and not investment advice.",
      },
      {
        heading: "The dashboard",
        body: "Results open in a React dashboard with five views: Home, Top Candidates, Stock Comparison, Research, and Advanced. Reports are stored in local SQLite history, so results stay reproducible and comparable over time, and any ranking can be downloaded as a CSV.",
        images: [
          {
            src: "/images/stock-app/dashboard-stock-comparison.jpg",
            alt: "Stock Comparison view with two stocks side by side, their total scores, and a factor score bar chart",
            caption:
              "The Stock Comparison view: two candidates side by side across all five factors. Interface captured October 13, 2026, from a saved report. An interface example, not current market prices.",
          },
          {
            src: "/images/stock-app/dashboard-research-summary.jpg",
            alt: "Stock Research Assistant research view with factor scores and data coverage for a selected company",
            caption:
              "The research view keeps the deterministic score separate from qualitative research and filing evidence.",
          },
        ],
      },
      {
        heading: "Under the hood",
        body: "Python throughout. Yahoo Finance supplies prices and screening fundamentals; SEC EDGAR supplies official company identity, filings, and Company Facts data. Missing or stale values stay visible instead of being filled in.",
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
    featured: false,
    status: "In progress",
    tagline:
      "Titanfall 2 pilot movement, rebuilt inside Portal's engine: sprinting, sliding, wallrunning, and double jumps in the test chambers.",
    log: [
      "Design freeze: v1 movement set locked",
      "Stage 1 in the test build: pilot speeds, gravity, jump",
      "Next: slide and slide-hop",
    ],
    lede: "A for-fun build run like a real project. Design is frozen; the build is under way.",
    sections: [
      {
        heading: "Status",
        body: "In progress. Weeks went into learning how Titanfall's movement is tuned and designing the rebuild before code was written. Stage 1, the base movement retune, is implemented in a test build; the slide is next.",
      },
      {
        heading: "The movement set",
        body: "Sprint at pilot speed, a slide that rewards momentum and chains into slide-hops, wallrunning on chamber walls, and a double jump. Grapple and Titan content are out of scope by design.",
      },
      {
        heading: "Build log",
        body: "Oct 24, 2026: design freeze. The v1 movement set and tuning targets were locked, including slide boost behavior and slide-hop as the first tuning priority. Oct 24, 2026: Stage 1 implemented in the test build, with Titanfall stand, sprint, and crouch speeds, gravity at pilot scale, and jump height to match. Instrumented speed checks are still to run; later stages follow in order.",
      },
    ],
  },
];

export function getProject(slug) {
  return projects.find((p) => p.slug === slug);
}
