# Scientometric Dashboard

An interactive web dashboard for exploring scientometric indicators across research institutions. It includes:

* a time-series view of publications and citations
* a citation-per-paper distribution chart
* key indicators such as h-index and total papers
* a journal breakdown with impact factors
* an altmetrics panel for social/news mentions
* a co-authorship network graph
* filters for year range, author, and research field
* interactive tooltips, highlighting, and export to CSV/JSON

The dashboard is designed for clean, presentation-friendly reporting with a limited number of main views on screen at once.

## Data sources

The app is built to use live scholarly metadata where available:

* **OpenAlex** for works, authors, institutions, and citation counts
* **Crossref Event Data** for altmetrics-style attention signals
* **Journal impact factor enrichment** via a local lookup table or external dataset

If live API calls fail or return no results, the dashboard falls back to bundled demo data so the interface remains usable.

## Target institutions

The default institution scope is:

* ETH Zurich (ETHZ)
* EPFL
* Eawag
* Empa
* PSI / Paul Scherrer Institute
* WSL

## Tech stack

* React
* D3.js
* Lucide icons
* Tailwind CSS for styling

## Requirements

* Node.js 18 or newer
* npm, pnpm, or yarn

## Getting started

### 1) Create a React app

The dashboard component is intended to run inside a React application. A simple option is Vite:

```bash
npm create vite@latest scientometric-dashboard -- --template react
cd scientometric-dashboard
npm install
```

### 2) Install dependencies

```bash
npm install d3 lucide-react
```

If your project does not already include Tailwind CSS, install and configure it according to the Tailwind docs for Vite + React.

### 3) Add the dashboard component

Copy the dashboard component into your project, for example:

```text
src/ScientometricDashboard.jsx
```

Then render it from `src/App.jsx`:

```jsx
import ScientometricDashboard from "./ScientometricDashboard";

export default function App() {
  return <ScientometricDashboard />;
}
```

### 4) Start the development server

```bash
npm run dev
```

Open the local address shown in your terminal, usually:

```text
http://localhost:5173
```

## How the data loading works

On startup, the app:

1. resolves the target institutions in OpenAlex
2. fetches works affiliated with those institutions
3. normalizes publication, citation, journal, and author fields
4. builds the charts and collaboration graph from the returned records
5. fetches altmetrics data for the selected paper

If no live data is available, the app switches to a bundled demo dataset so that all views still render.

## Running with live data

The dashboard uses public APIs and should work without API keys for the default setup. Keep in mind:

* public APIs may apply rate limits
* some DOI or institution searches may return no exact match
* altmetrics coverage varies by paper

For larger deployments, consider adding:

* server-side caching
* request throttling
* a curated journal impact-factor dataset
* a custom institution mapping table

## Export options

The dashboard supports:

* **CSV export** for the currently filtered paper set
* **JSON export** for filtered records and active filter settings

## Customization ideas

Common extensions include:

* replacing the demo impact-factor map with a maintained journal metrics table
* adding institution-level ranking cards
* adding ORCID links for authors
* adding a DOI copy button to paper rows
* adding a search box for paper titles
* adding a publication-type filter
* adding a date brush for finer time-window selection

## Troubleshooting

### The dashboard shows demo data only

This usually means the live API queries returned no results, timed out, or were rate-limited. Try again later or verify that the institution names match OpenAlex records.

### Charts appear empty

Make sure:

* the component is being rendered inside a browser environment
* React and D3 are installed
* Tailwind classes are available in your app
* the data array contains publication years

### The collaboration map looks crowded

Use the year, author, and field filters to reduce the active dataset. The network graph is intentionally capped to keep the screen readable.

## Suggested repository structure

```text
scientometric-dashboard/
├─ src/
│  ├─ App.jsx
│  ├─ ScientometricDashboard.jsx
│  └─ main.jsx
├─ public/
├─ package.json
└─ README.md
```

## License

Choose a license that fits your repository policy, such as MIT or Apache-2.0.

## Acknowledgements

Built for exploratory bibliometrics and institutional research analytics.
