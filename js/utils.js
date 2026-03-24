/**
 * utils.js — Shared D3 Utility Functions
 *
 * Reusable helpers for all visualization modules. Every module should
 * use these instead of rolling their own SVG setup, tooltips, etc.
 * This keeps the codebase DRY and makes style changes propagate globally.
 */

const Utils = (() => {

  // -----------------------------------------------------------------------
  // Color palettes — accessible, colorblind-friendly
  // -----------------------------------------------------------------------

  const PALETTE = {
    // Main categorical palette (Wong, 2011 — Nature Methods)
    categorical: [
      "#0072B2", "#E69F00", "#009E73", "#CC79A7",
      "#56B4E9", "#D55E00", "#F0E442", "#999999",
    ],
    // Sequential blue for ordered data
    sequential: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"],
    // Diverging for FWCI (below/above average)
    diverging: ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
    // Output-type specific colors
    outputTypes: {
      article: "#0072B2",
      preprint: "#56B4E9",
      dataset: "#009E73",
      software: "#E69F00",
      review: "#CC79A7",
      book_chapter: "#D55E00",
    },
  };

  // -----------------------------------------------------------------------
  // SVG creation with responsive container
  // -----------------------------------------------------------------------

  /**
   * Create an SVG inside the given container with proper margins.
   * Returns { svg, width, height } where width/height are the inner
   * drawing area dimensions.
   *
   * @param {string} selector  CSS selector for the container element
   * @param {object} margin    { top, right, bottom, left }
   * @param {number} [aspectRatio=0.5]  height = width * aspectRatio
   */
  function createSvg(selector, margin, aspectRatio = 0.5) {
    const container = d3.select(selector);
    container.selectAll("svg").remove(); // Clear previous

    const containerWidth = container.node().getBoundingClientRect().width || 500;
    const totalWidth = containerWidth;
    const totalHeight = totalWidth * aspectRatio;
    const width = totalWidth - margin.left - margin.right;
    const height = totalHeight - margin.top - margin.bottom;

    const svg = container.append("svg")
      .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("class", "viz-svg")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    return { svg, width, height, totalWidth, totalHeight };
  }

  // -----------------------------------------------------------------------
  // Tooltip
  // -----------------------------------------------------------------------

  /** Create (or reuse) a shared tooltip div. */
  function createTooltip() {
    let tip = d3.select("#viz-tooltip");
    if (tip.empty()) {
      tip = d3.select("body").append("div")
        .attr("id", "viz-tooltip")
        .attr("class", "tooltip")
        .style("opacity", 0);
    }
    return tip;
  }

  /** Show tooltip near the mouse with the given HTML content. */
  function showTooltip(tip, event, html) {
    tip.html(html)
      .style("opacity", 1)
      .style("left", `${event.pageX + 12}px`)
      .style("top", `${event.pageY - 28}px`);
  }

  /** Hide tooltip. */
  function hideTooltip(tip) {
    tip.style("opacity", 0);
  }

  // -----------------------------------------------------------------------
  // Axes helpers
  // -----------------------------------------------------------------------

  /** Append a bottom X axis with a label. */
  function addXAxis(svg, scale, height, label, isTime = false) {
    const axis = isTime
      ? d3.axisBottom(scale).tickFormat(d3.format("d"))
      : d3.axisBottom(scale);

    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(axis)
      .selectAll("text")
      .style("font-size", "11px");

    if (label) {
      svg.append("text")
        .attr("class", "axis-label")
        .attr("x", scale.range()[1] / 2)
        .attr("y", height + 38)
        .attr("text-anchor", "middle")
        .text(label);
    }
  }

  /** Append a left Y axis with a label. */
  function addYAxis(svg, scale, label) {
    svg.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(scale).ticks(5))
      .selectAll("text")
      .style("font-size", "11px");

    if (label) {
      svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(scale.range()[0]) / 2)
        .attr("y", -42)
        .attr("text-anchor", "middle")
        .text(label);
    }
  }

  // -----------------------------------------------------------------------
  // DORA context note
  // -----------------------------------------------------------------------

  /**
   * Append a small note beneath a visualization explaining DORA context.
   * This is central to our philosophy: every metric shown should carry
   * context about its limitations and proper interpretation.
   */
  function addDORANote(selector, text) {
    d3.select(selector).append("p")
      .attr("class", "dora-note")
      .html(`<span class="dora-badge">DORA</span> ${text}`);
  }

  // -----------------------------------------------------------------------
  // Legend builder
  // -----------------------------------------------------------------------

  /**
   * Append a horizontal legend below the SVG.
   * @param {string} selector  Container selector
   * @param {Array} items      [{ label, color }]
   */
  function addLegend(selector, items) {
    const legend = d3.select(selector).append("div")
      .attr("class", "chart-legend");

    items.forEach(item => {
      const entry = legend.append("span").attr("class", "legend-entry");
      entry.append("span")
        .attr("class", "legend-swatch")
        .style("background-color", item.color);
      entry.append("span").text(item.label);
    });
  }

  // -----------------------------------------------------------------------
  // Data aggregation helpers
  // -----------------------------------------------------------------------

  /** Group publications by year. */
  function groupByYear(publications) {
    return d3.group(publications, d => d.year);
  }

  /** Group publications by type. */
  function groupByType(publications) {
    return d3.group(publications, d => d.type);
  }

  /** Compute cumulative h-index over time. */
  function computeHIndex(publications) {
    // Sort descending by citations
    const sorted = [...publications].sort((a, b) => b.citations - a.citations);
    let h = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].citations >= i + 1) h = i + 1;
      else break;
    }
    return h;
  }

  /** Pretty-print output type names. */
  function formatType(type) {
    const labels = {
      article: "Journal Article",
      preprint: "Preprint",
      dataset: "Dataset",
      software: "Software",
      review: "Review",
      book_chapter: "Book Chapter",
    };
    return labels[type] || type;
  }

  /** Default transition duration. */
  function T() { return d3.transition().duration(600).ease(d3.easeCubicOut); }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return {
    PALETTE,
    createSvg,
    createTooltip,
    showTooltip,
    hideTooltip,
    addXAxis,
    addYAxis,
    addDORANote,
    addLegend,
    groupByYear,
    groupByType,
    computeHIndex,
    formatType,
    T,
  };

})();
