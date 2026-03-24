# Scientometric Dashboard // DORA

A browser-based, interactive dashboard for visualizing researcher output profiles using principles from the **San Francisco Declaration on Research Assessment (DORA)**.

Instead of reducing a career to a single number (h-index, Impact Factor), this dashboard shows the full picture: what types of work a researcher produces, how citations actually distribute across their outputs, who they collaborate with, and where their work gets attention beyond academia.

## Why DORA?

The [DORA declaration](https://sfdora.org) argues that journal-based metrics like Impact Factor are poor proxies for individual research quality. Citation distributions are skewed, field norms vary wildly, and datasets/software/preprints are real research outputs that deserve recognition. This dashboard was built with those principles baked in — every visualization carries a DORA context note explaining what it shows and what it deliberately avoids.

Key principles we follow:

- **No Journal Impact Factor** as a quality surrogate (DORA Rec. #1)
- **Article-level metrics** that show the full distribution, not just averages
- **All output types** valued: articles, datasets, software, preprints, reviews (Rec. #3 & #5)
- **Field-normalized** citation impact (FWCI) to compare fairly across disciplines (Rec. #14)
- **Multi-dimensional impact**: citations, downloads, social media, news, policy (Rec. #17)
- **Transparent methods**: all code is open, data generation is reproducible

## Visualizations

The dashboard includes 9 D3.js visualization modules:

1. **Publication Timeline** — Stacked bar chart of output types per year
2. **Citation Distribution** — Jittered strip plot showing every individual output's citations (the skew is the point)
3. **Output Diversity** — Donut chart breaking down the portfolio by type
4. **Collaboration Network** — Force-directed graph of co-author relationships
5. **Impact Radar** — Spider chart across 6 dimensions of impact
6. **Attention Landscape** — Bubble chart mapping traditional vs. alternative metrics
7. **Open Access Trajectory** — Stacked area chart of OA vs. closed over time
8. **Topic Evolution** — Streamgraph showing how research themes shift over a career
9. **FWCI Timeline** — Field-weighted citation impact trend with world-average reference line

## Quick Start

```bash
# 1. Clone or download this repo

# 2. (Optional) Regenerate the synthetic data
python generate_data.py

# 3. Start a local server
python -m http.server 8000

# 4. Open http://localhost:8000 in your browser
```

That's it. No `npm install`, no build step, no webpack config to debug at 2am.

## Project Structure

```
├── index.html              # Entry point
├── css/
│   └── style.css           # All styling (CSS Grid layout, responsive)
├── js/
│   ├── utils.js            # Shared D3 helpers (SVG, tooltips, scales, legends)
│   ├── dashboard.js         # Main orchestrator (search, stats, module rendering)
│   └── modules/
│       ├── timeline.js      # Stacked bar: outputs over time
│       ├── citationDist.js  # Strip plot: article-level citations
│       ├── outputDiversity.js # Donut: output type breakdown
│       ├── collaboration.js # Force graph: co-author network
│       ├── impactRadar.js   # Radar: multi-dimensional impact
│       ├── altmetrics.js    # Bubble: traditional vs. alternative metrics
│       ├── openAccess.js    # Area: OA trajectory
│       ├── topicStream.js   # Streamgraph: topic evolution
│       └── fwciTimeline.js  # Line: field-weighted citation impact
├── data/
│   └── researchers.json     # Synthetic researcher data
├── generate_data.py         # Python script to regenerate data
├── LICENSE                  # MIT
├── requirements.txt         # Runtime & dev dependencies
└── README.md                # You are here
```

## Using Your Own Data

The dashboard reads from `data/researchers.json`. Each researcher entry looks like:

```json
{
  "Researcher Name": {
    "affiliation": "...",
    "orcid": "0000-...",
    "primary_field": "...",
    "publications": [
      {
        "year": 2020,
        "type": "article|dataset|software|preprint|review|book_chapter",
        "citations": 45,
        "field_weighted_citation_impact": 1.8,
        "open_access": true,
        "topics": ["topic1", "topic2"],
        "coauthors": ["Name1", "Name2"],
        "venue": "Journal Name",
        "altmetrics": {
          "twitter_mentions": 120,
          "news_mentions": 3,
          "blog_mentions": 5,
          "policy_citations": 1,
          "wikipedia_citations": 0,
          "downloads": 890
        }
      }
    ]
  }
}
```

You can adapt `generate_data.py` to pull from real APIs (OpenAlex, Semantic Scholar, Crossref) or manually curate entries.

## Inspiration & References

- **DORA**: [San Francisco Declaration on Research Assessment](https://sfdora.org) — the philosophical backbone
- **SciEvo**: [github.com/Ahren09/SciEvo](https://github.com/Ahren09/SciEvo) — longitudinal scientometric dataset that inspired our data model
- **D3.js Gallery**: [observablehq.com/@d3/gallery](https://observablehq.com/@d3/gallery) — the visualization techniques (stacked bars, force graphs, streamgraphs, radar charts) all trace back here
- **Scientometric Visualization**: [Springer article on scientometric viz](https://link.springer.com/article/10.1007/s44230-025-00089-3) — survey of visualization approaches for bibliometric data
- **Wong (2011)**: "Points of view: Color blindness" — Nature Methods. Our color palette.
- **Altmetrics**: [altmetrics.org](https://altmetrics.org) — manifesto for alternative scholarly metrics

## Design Decisions

- **Vanilla JS + D3 only**: no React, no Vue, no build tools. The goal is a dashboard anyone can fork, modify, and deploy to GitHub Pages in under 5 minutes.
- **IIFE modules**: each visualization is a self-contained IIFE that exposes a single `render(publications)` function. Swap one out, and nothing else breaks.
- **Shared `Utils`**: all SVG scaffolding, tooltips, legends, and color scales live in one place. Change a color palette once, and it propagates everywhere.
- **Responsive SVGs**: every chart uses `viewBox` for responsive scaling. No fixed pixel sizes.
- **DORA notes**: every chart has a contextual note explaining why it exists and which DORA recommendation it addresses. The dashboard is educational, not just decorative.

## License

MIT — do whatever you want with it. See [LICENSE](LICENSE).
