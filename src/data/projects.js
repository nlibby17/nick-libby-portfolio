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
    backdrop: "topo",
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
    slug: "cyclistic-capstone",
    title: "Cyclistic Capstone",
    cardType: "stat",
    splash: "var(--splash-cyclistic)",
    featured: true,
    wide: true,
    tagline:
      "A full year of Chicago bike-share trips, 6 million rides, cleaned in Python and read in Power BI",
    stats: [
      { value: "6,007,212", label: "rides analyzed" },
      { value: "12", label: "months of data" },
      { value: "1.5x", label: "longer casual rides" },
    ],
    lede: "How annual members and casual riders use the same Chicago bike-share system differently, answered from the system's own trip records.",
    backdrop: "route",
    pipeTone: "silver",
    hero: {
      heading: "The dashboard",
      body: "The finished Power BI dashboard. Two pages, eight views, and every chart title is a finding, so the dashboard reads as the answer before the write-up begins.",
      src: "/images/cyclistic/00-overview-page.png",
      alt: "Power BI dashboard overview page: 6,007,212 total rides split between members and casual riders, average ride length by group, rides by month, rides by day of week, and the weekday versus weekend split",
      caption:
        "Overview page. Members make up about two thirds of all rides; casual riders are the weekend's near-half.",
    },
    pipelineAfter: 1,
    pipeline: {
      heading: "How it was built",
      steps: [
        {
          title: "Twelve monthly files",
          body: "Chicago's trip data is published one month at a time. The year from October 2025 through September 2026 arrived as twelve separate files holding 6,171,785 rows between them, and they were never merged by hand.",
        },
        {
          title: "One Python script",
          body: "A single pandas script reads the twelve files one at a time, applies the cleaning rules, and appends to one cleaned dataset, logging every row it drops and why. It dropped 164,573 rows (2.67 percent), every one of them accounted for in the cleaning log.",
        },
        {
          title: "The dashboard",
          body: "The cleaned 6,007,212 rides load into Power BI, where two dashboard pages take the question from five angles: volume, ride length, timing, equipment, and stations.",
        },
        {
          title: "Recommendations",
          body: "The patterns resolve into three recommendations for converting casual riders into annual members, the goal the analysis was built to serve. They close this page.",
        },
      ],
    },
    sections: [
      {
        heading: "The question",
        body: "Cyclistic, a Chicago bike-share company with more than 5,800 bicycles across 600 docking stations, has concluded that its growth depends on converting casual riders into annual members. Before the marketing team could design that campaign, it needed clear evidence of how the two groups actually ride differently. The business task: use the previous twelve months of trip data to identify the differences, and turn them into a conversion marketing strategy.",
      },
      {
        heading: "What the data showed",
        body: "Members ride like commuters. Their volume peaks Tuesday through Thursday, holds steady across the year, and averages 12.2 minutes a trip. Casual riders ride for leisure: their trips average 18.2 minutes, run longest on Sundays at 21.1 minutes, peak on Saturdays, and make up about 46 percent of all weekend rides against about 31 percent on weekdays. Casual volume collapses in the January cold while member volume only dips. Both groups reach for e-bikes most of the time (about 70 percent of all rides, and about 74 percent of casual rides), and casual rides start at lakefront attractions: Navy Pier, Millennium Park, the Shedd Aquarium, and the DuSable Lake Shore Drive corridor. One line covers it: members use the system to get to work, and casual riders use it to enjoy the city.",
      },
      {
        heading: "The dashboard, view by view",
        body: "The overview page's four charts, at reading size. The dashboard itself sits at the top of this page.",
        images: [
          {
            src: "/images/cyclistic/01-avg-ride-length.png",
            alt: "Bar chart: average ride length, casual riders 18.2 minutes against members 12.2 minutes",
            caption: "Casual rides run about 1.5x longer than member rides.",
          },
          {
            src: "/images/cyclistic/02-rides-by-month.png",
            alt: "Line chart of rides by month for both groups: a late-summer peak and a January trough, deeper for casual riders",
            caption:
              "Both groups peak in late summer and bottom out in January; the casual line falls much further.",
          },
          {
            src: "/images/cyclistic/03-rides-by-day-of-week.png",
            alt: "Bar chart of rides by day of week: members peak Tuesday to Thursday, casual riders peak on Saturday",
            caption: "Members peak midweek, casual riders peak on Saturday.",
          },
          {
            src: "/images/cyclistic/04-weekend-vs-weekday.png",
            alt: "Bar chart of weekday against weekend rides by group",
            caption:
              "Casual riders make up nearly half of all weekend rides: about 46 percent, against about 31 percent on weekdays.",
          },
        ],
      },
      {
        heading: "The details page",
        body: "The second page takes equipment, daily ride length, and the geography of casual starts.",
        images: [
          {
            src: "/images/cyclistic/05-rideable-type.png",
            alt: "Bar chart of rides by bicycle type: e-bikes dominate for both groups",
            caption:
              "Both groups reach for e-bikes most of the time: about 70 percent of all rides, 74 percent of casual rides.",
          },
          {
            src: "/images/cyclistic/06-avg-length-by-day.png",
            alt: "Bar chart of average ride length by day of week: casual rides are longer on all seven days and longest on Sundays",
            caption:
              "Casual rides are longest on Sundays and Saturdays, and longer than member rides on all seven days.",
          },
          {
            src: "/images/cyclistic/07-top-casual-stations.png",
            alt: "Bar chart of the top ten casual start stations, led by Navy Pier, DuSable Lake Shore Drive and Monroe Street, and Michigan Avenue and Oak Street",
            caption:
              "Casual rides start at lakefront attractions: Navy Pier (about 49K rides), the DuSable Lake Shore Drive corridor, Millennium Park, the Shedd Aquarium. Counts are read from the chart axis.",
          },
        ],
      },
      {
        heading: "Recommendations",
        body: "1. Sell membership where casual rides begin: conversion offers at the top casual start stations (Navy Pier, Millennium Park, the Shedd Aquarium, the lakefront corridor) and in the app at the end of casual weekend rides, when the pitch meets the rider at the moment of the experience. 2. Run the main campaign in early spring, as casual riders come back and before the bulk of the busy season: a membership bought in early spring covers the whole riding season, and winter spending on this audience is wasted. 3. Pitch the pattern casual riders already live (long weekend rides, e-bikes, the lakefront) as a leisure membership, not a commuter product sold to people who do not commute.",
      },
      {
        heading: "Code",
        body: "The cleaning script, the full report, and the cleaning log live in the project repository. The dashboard file itself runs 368 MB, over GitHub's file limit, so the repository carries its output instead: every chart, as shown on this page.",
        link: {
          label: "github.com/nlibby17/cyclistic-capstone",
          href: "https://github.com/nlibby17/cyclistic-capstone",
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
