/**
 * citationDist.js — Article-Level Citation Distribution (Beeswarm / Strip Plot)
 *
 * Shows citations for EACH individual publication as a dot, revealing
 * the true distribution. This is a core DORA principle: citation
 * distributions are highly skewed, so averages (and journal-level
 * aggregates like Impact Factor) are misleading.
 *
 * Inspired by: D3 Beeswarm plot, strip plots, jittered dot plots
 */

const CitationDistModule = (() => {

  const SELECTOR = "#viz-citation-dist";

  function render(publications) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Article-Level Citation Distribution");

    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const { svg, width, height } = Utils.createSvg(SELECTOR, margin, 0.5);
    const tip = Utils.createTooltip();

    // ---- Data: only items with potential citations ----
    const data = publications.filter(p => p.year < 2025);

    // ---- Scales ----
    const years = [...new Set(data.map(d => d.year))].sort();

    const x = d3.scaleBand()
      .domain(years)
      .range([0, width])
      .padding(0.3);

    const maxCit = d3.max(data, d => d.citations) || 1;
    const y = d3.scaleLinear()
      .domain([0, maxCit])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(Object.keys(Utils.PALETTE.outputTypes))
      .range(Object.values(Utils.PALETTE.outputTypes));

    // ---- Draw dots with jitter ----
    svg.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d.year) + x.bandwidth() / 2 +
        (Math.random() - 0.5) * x.bandwidth() * 0.7)
      .attr("cy", height)  // animate from bottom
      .attr("r", 0)
      .attr("fill", d => color(d.type))
      .attr("opacity", 0.7)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseover", (event, d) => {
        Utils.showTooltip(tip, event,
          `<strong>${Utils.formatType(d.type)}</strong> (${d.year})<br>` +
          `Citations: ${d.citations}<br>` +
          `FWCI: ${d.field_weighted_citation_impact}<br>` +
          `Venue: ${d.venue || "N/A"}`);
        d3.select(event.target).attr("r", 6).attr("opacity", 1);
      })
      .on("mouseout", (event) => {
        Utils.hideTooltip(tip);
        d3.select(event.target).attr("r", 3.5).attr("opacity", 0.7);
      })
      .transition(Utils.T())
      .delay((_, i) => i * 3)
      .attr("cy", d => y(d.citations))
      .attr("r", 3.5);

    // ---- Median line per year ----
    const medians = years.map(yr => {
      const vals = data.filter(d => d.year === yr).map(d => d.citations);
      return { year: yr, median: d3.median(vals) || 0 };
    });

    svg.selectAll(".median-line")
      .data(medians)
      .join("line")
      .attr("class", "median-line")
      .attr("x1", d => x(d.year))
      .attr("x2", d => x(d.year) + x.bandwidth())
      .attr("y1", d => y(d.median))
      .attr("y2", d => y(d.median))
      .attr("stroke", "#333")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,3")
      .attr("opacity", 0.6);

    // ---- Axes ----
    Utils.addXAxis(svg, x, height, "Year");
    Utils.addYAxis(svg, y, "Citations per Output");

    // ---- Legend ----
    const typesPresent = [...new Set(data.map(d => d.type))];
    Utils.addLegend(SELECTOR,
      typesPresent.map(t => ({ label: Utils.formatType(t), color: color(t) })));

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "Citation distributions within journals are highly skewed. " +
      "Each dot is one output — dashed lines show yearly medians. " +
      "Averages hide this variation (DORA Rec. #1).");
  }

  return { render };

})();
