/**
 * dashboard.js — Main Dashboard Orchestrator
 *
 * Loads the researcher data, handles the search/select UI, and
 * triggers all visualization modules when a researcher is selected.
 * Also computes and displays a DORA-aligned summary statistics panel.
 */

const Dashboard = (() => {

  let researcherData = {};

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  async function init() {
    try {
      const resp = await fetch("data/researchers.json");
      researcherData = await resp.json();
      populateSearch();
      showLanding();
    } catch (err) {
      console.error("Failed to load data:", err);
      document.getElementById("dashboard-content").innerHTML =
        `<p class="error">Failed to load researcher data. ` +
        `Make sure to serve via HTTP (see README).</p>`;
    }
  }

  // -----------------------------------------------------------------------
  // Search / selection UI
  // -----------------------------------------------------------------------

  function populateSearch() {
    const datalist = document.getElementById("researcher-list");
    const names = Object.keys(researcherData).sort();
    names.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      datalist.appendChild(opt);
    });

    // Quick-select buttons
    const quickSelect = document.getElementById("quick-select");
    names.forEach(name => {
      const btn = document.createElement("button");
      btn.textContent = name;
      btn.className = "quick-btn";
      btn.addEventListener("click", () => selectResearcher(name));
      quickSelect.appendChild(btn);
    });
  }

  function handleSearch() {
    const input = document.getElementById("researcher-input").value.trim();
    if (researcherData[input]) {
      selectResearcher(input);
    } else {
      // Fuzzy match: check if input is a substring of any name
      const match = Object.keys(researcherData).find(name =>
        name.toLowerCase().includes(input.toLowerCase()));
      if (match) {
        document.getElementById("researcher-input").value = match;
        selectResearcher(match);
      } else {
        showNotFound(input);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Display logic
  // -----------------------------------------------------------------------

  function showLanding() {
    const content = document.getElementById("dashboard-content");
    content.innerHTML = `
      <div class="landing">
        <h2>Welcome to the DORA-Aligned Scientometric Dashboard</h2>
        <p>
          This dashboard visualizes research outputs using principles from the
          <strong>San Francisco Declaration on Research Assessment (DORA)</strong>.
          It emphasizes article-level metrics, diverse output types, and
          multi-dimensional impact — rather than journal-based proxies like
          Impact Factor.
        </p>
        <p>Enter a researcher name above or click a quick-select button to begin.</p>
        <div class="dora-principles">
          <h3>Guiding Principles</h3>
          <ul>
            <li>No journal-level metrics as surrogates for individual quality</li>
            <li>Article-level assessment showing full citation distributions</li>
            <li>All output types valued: datasets, software, preprints</li>
            <li>Field-normalized metrics that account for disciplinary norms</li>
            <li>Multiple dimensions of impact: social, policy, scholarly</li>
            <li>Transparency in methods and data</li>
          </ul>
        </div>
      </div>`;
  }

  function showNotFound(query) {
    const content = document.getElementById("dashboard-content");
    content.innerHTML = `
      <div class="landing">
        <p class="error">No researcher found matching "${query}".
        Try one of the names above.</p>
      </div>`;
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  function selectResearcher(name) {
    const researcher = researcherData[name];
    if (!researcher) return;

    // Update active button styling
    document.querySelectorAll(".quick-btn").forEach(btn => {
      btn.classList.toggle("active", btn.textContent === name);
    });

    const content = document.getElementById("dashboard-content");

    // ---- Build the summary stats panel ----
    const pubs = researcher.publications;
    const stats = computeStats(pubs);

    content.innerHTML = `
      <div class="researcher-header">
        <h2>${researcher.name}</h2>
        <p class="affiliation">${researcher.affiliation}</p>
        <p class="orcid">ORCID: <a href="https://orcid.org/${researcher.orcid}"
           target="_blank">${researcher.orcid}</a></p>
        <p class="fields">Fields: ${researcher.primary_field.replace(/_/g, " ")} ·
           ${researcher.secondary_field.replace(/_/g, " ")}</p>
      </div>

      <div class="stats-grid">
        ${statCard("Total Outputs", stats.totalOutputs, "All types combined")}
        ${statCard("Output Types", stats.uniqueTypes, "Distinct categories")}
        ${statCard("Collaborators", stats.uniqueCollaborators, "Unique co-authors")}
        ${statCard("Total Citations", stats.totalCitations, "All outputs combined")}
        ${statCard("Median Citations", stats.medianCitations, "Per output (skew-resistant)")}
        ${statCard("Mean FWCI", stats.meanFWCI, "1.0 = world average")}
        ${statCard("Open Access", stats.oaPct + "%", "Of all outputs")}
        ${statCard("Career Span", stats.careerSpan + " yrs",
          stats.firstYear + "–" + stats.lastYear)}
      </div>

      <div class="viz-grid">
        <div class="viz-card wide" id="viz-timeline"></div>
        <div class="viz-card wide" id="viz-citation-dist"></div>
        <div class="viz-card" id="viz-output-diversity"></div>
        <div class="viz-card" id="viz-collaboration"></div>
        <div class="viz-card" id="viz-impact-radar"></div>
        <div class="viz-card" id="viz-altmetrics"></div>
        <div class="viz-card wide" id="viz-open-access"></div>
        <div class="viz-card wide" id="viz-topic-stream"></div>
        <div class="viz-card wide" id="viz-fwci"></div>
      </div>

      <footer class="dashboard-footer">
        <p>
          Built following the
          <a href="https://sfdora.org" target="_blank">DORA Declaration</a>
          principles. Data is synthetic and for demonstration only.
        </p>
      </footer>`;

    // ---- Render all modules ----
    // Small delay to let DOM paint
    requestAnimationFrame(() => {
      TimelineModule.render(pubs);
      CitationDistModule.render(pubs);
      OutputDiversityModule.render(pubs);
      CollaborationModule.render(pubs, researcher.name);
      ImpactRadarModule.render(pubs);
      AltmetricsModule.render(pubs);
      OpenAccessModule.render(pubs);
      TopicStreamModule.render(pubs);
      FWCITimelineModule.render(pubs);
    });
  }

  // -----------------------------------------------------------------------
  // Stats computation
  // -----------------------------------------------------------------------

  function computeStats(pubs) {
    const citations = pubs.map(p => p.citations);
    const fwci = pubs.map(p => p.field_weighted_citation_impact).filter(v => v > 0);
    const years = pubs.map(p => p.year);

    return {
      totalOutputs: pubs.length,
      uniqueTypes: new Set(pubs.map(p => p.type)).size,
      uniqueCollaborators: new Set(pubs.flatMap(p => p.coauthors)).size,
      totalCitations: d3.sum(citations),
      medianCitations: d3.median(citations)?.toFixed(0) || 0,
      meanFWCI: fwci.length ? d3.mean(fwci).toFixed(2) : "N/A",
      oaPct: ((pubs.filter(p => p.open_access).length / pubs.length) * 100).toFixed(0),
      careerSpan: d3.max(years) - d3.min(years),
      firstYear: d3.min(years),
      lastYear: d3.max(years),
    };
  }

  /** Helper: generate a stat card HTML snippet. */
  function statCard(label, value, subtitle) {
    return `
      <div class="stat-card">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        <div class="stat-subtitle">${subtitle}</div>
      </div>`;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return { init, handleSearch };

})();

// ---- Boot ----
document.addEventListener("DOMContentLoaded", Dashboard.init);
