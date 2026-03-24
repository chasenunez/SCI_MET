/**
 * fwciTimeline.js — Field-Weighted Citation Impact Over Time (Line + Area)
 *
 * Plots the running average FWCI per year. A value of 1.0 means
 * "average for the field" — the dashed reference line. This is one of
 * the best DORA-aligned citation metrics because it accounts for
 * field-specific citation norms (Rec. #14).
 *
 * Inspired by: D3 Line Chart (Observable @d3/line-chart)
 */

const FWCITimelineModule = (() => {

  const SELECTOR = "#viz-fwci";

  function render(publications) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Field-Weighted Citation Impact (FWCI) Over Time");

    const margin = { top: 20, right: 20, bottom: 50, left: 55 };
    const { svg, width, height } = Utils.createSvg(SELECTOR, margin, 0.4);
    const tip = Utils.createTooltip();

    // ---- Data: yearly average FWCI ----
    const byYear = Utils.groupByYear(publications);
    const years = [...byYear.keys()].sort();

    const data = years.map(year => {
      const pubs = byYear.get(year);
      const values = pubs.map(p => p.field_weighted_citation_impact).filter(v => v > 0);
      return {
        year,
        mean: values.length ? d3.mean(values) : 0,
        median: values.length ? d3.median(values) : 0,
        count: pubs.length,
      };
    }).filter(d => d.mean > 0);

    // ---- Scales ----
    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.year))
      .range([0, width]);

    const maxFWCI = d3.max(data, d => d.mean) || 2;
    const y = d3.scaleLinear()
      .domain([0, Math.max(maxFWCI * 1.2, 2.5)])
      .range([height, 0]);

    // ---- Reference line at FWCI = 1.0 (world average) ----
    svg.append("line")
      .attr("x1", 0).attr("x2", width)
      .attr("y1", y(1)).attr("y2", y(1))
      .attr("stroke", "#E69F00")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "8,4");

    svg.append("text")
      .attr("x", width - 5).attr("y", y(1) - 6)
      .attr("text-anchor", "end")
      .style("font-size", "10px")
      .style("fill", "#E69F00")
      .style("font-weight", "600")
      .text("World Average (1.0)");

    // ---- Area under the FWCI line ----
    const area = d3.area()
      .x(d => x(d.year))
      .y0(height)
      .y1(d => y(d.mean))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("d", area)
      .attr("fill", Utils.PALETTE.categorical[0])
      .attr("fill-opacity", 0.15);

    // ---- FWCI line ----
    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.mean))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(data)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", Utils.PALETTE.categorical[0])
      .attr("stroke-width", 2.5);

    // ---- Dots ----
    svg.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.mean))
      .attr("r", 4)
      .attr("fill", Utils.PALETTE.categorical[0])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .on("mouseover", (event, d) => {
        Utils.showTooltip(tip, event,
          `<strong>${d.year}</strong><br>` +
          `Mean FWCI: ${d.mean.toFixed(2)}<br>` +
          `Median FWCI: ${d.median.toFixed(2)}<br>` +
          `Outputs: ${d.count}`);
      })
      .on("mouseout", () => Utils.hideTooltip(tip));

    // ---- Axes ----
    Utils.addXAxis(svg, x, height, "Year", true);
    Utils.addYAxis(svg, y, "Field-Weighted Citation Impact");

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "FWCI normalizes citations by field, year, and document type — " +
      "a fairer metric than raw citation counts. The dashed line is " +
      "world average (1.0). Still, no single number tells the whole story " +
      "(DORA Rec. #14).");
  }

  return { render };

})();
