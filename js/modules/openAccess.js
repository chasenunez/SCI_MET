/**
 * openAccess.js — Open Access Trajectory (Stacked Area Chart)
 *
 * Shows the proportion of open-access vs. closed-access outputs over
 * time. DORA's broader vision includes open science and removing
 * barriers to reuse (Rec. #9, #10).
 *
 * Inspired by: D3 Stacked Area Chart (Observable @d3/stacked-area-chart)
 */

const OpenAccessModule = (() => {

  const SELECTOR = "#viz-open-access";

  function render(publications) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Open Access Trajectory");

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const { svg, width, height } = Utils.createSvg(SELECTOR, margin, 0.4);
    const tip = Utils.createTooltip();

    // ---- Data ----
    const byYear = Utils.groupByYear(publications);
    const years = [...byYear.keys()].sort();

    const stackData = years.map(year => {
      const pubs = byYear.get(year);
      return {
        year,
        open: pubs.filter(p => p.open_access).length,
        closed: pubs.filter(p => !p.open_access).length,
      };
    });

    // ---- Scales ----
    const x = d3.scaleLinear()
      .domain(d3.extent(years))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stackData, d => d.open + d.closed)])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(["open", "closed"])
      .range(["#009E73", "#CC79A7"]);

    // ---- Stack ----
    const stack = d3.stack().keys(["open", "closed"]);
    const series = stack(stackData);

    const area = d3.area()
      .x(d => x(d.data.year))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveMonotoneX);

    // ---- Draw areas ----
    svg.selectAll("path.area")
      .data(series)
      .join("path")
      .attr("class", "area")
      .attr("d", area)
      .attr("fill", d => color(d.key))
      .attr("opacity", 0.8);

    // ---- Overlay for tooltip ----
    svg.selectAll("rect.overlay")
      .data(stackData)
      .join("rect")
      .attr("class", "overlay")
      .attr("x", (d, i) => i === 0 ? 0 : x(d.year) - (x(years[1]) - x(years[0])) / 2)
      .attr("width", years.length > 1 ? (x(years[1]) - x(years[0])) : width)
      .attr("y", 0)
      .attr("height", height)
      .attr("fill", "transparent")
      .on("mouseover", (event, d) => {
        const total = d.open + d.closed;
        const pct = total ? ((d.open / total) * 100).toFixed(0) : 0;
        Utils.showTooltip(tip, event,
          `<strong>${d.year}</strong><br>` +
          `Open Access: ${d.open} (${pct}%)<br>` +
          `Closed: ${d.closed}`);
      })
      .on("mouseout", () => Utils.hideTooltip(tip));

    // ---- Axes ----
    Utils.addXAxis(svg, x, height, "Year", true);
    Utils.addYAxis(svg, y, "Number of Outputs");

    // ---- Legend ----
    Utils.addLegend(SELECTOR, [
      { label: "Open Access", color: "#009E73" },
      { label: "Closed Access", color: "#CC79A7" },
    ]);

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "Open access supports the free flow of scientific knowledge. " +
      "Remove reuse limitations where possible (DORA Rec. #9).");
  }

  return { render };

})();
