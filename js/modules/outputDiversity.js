/**
 * outputDiversity.js — Research Output Diversity (Donut Chart)
 *
 * Visualizes the proportion of different output types in a researcher's
 * portfolio. DORA explicitly calls for valuing datasets, software, and
 * other non-article outputs (Recommendations #3 and #5).
 *
 * Inspired by: D3 Donut Chart (Observable @d3/donut-chart)
 */

const OutputDiversityModule = (() => {

  const SELECTOR = "#viz-output-diversity";

  function render(publications) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Research Output Diversity");

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const { svg, width, height, totalWidth, totalHeight } =
      Utils.createSvg(SELECTOR, margin, 0.6);
    const tip = Utils.createTooltip();

    // ---- Data ----
    const byType = Utils.groupByType(publications);
    const data = [...byType.entries()].map(([type, pubs]) => ({
      type,
      count: pubs.length,
      label: Utils.formatType(type),
    }));
    data.sort((a, b) => b.count - a.count);

    const total = d3.sum(data, d => d.count);
    const radius = Math.min(width, height) / 2 - 10;

    // ---- Pie / Arc generators ----
    const pie = d3.pie().value(d => d.count).sort(null).padAngle(0.02);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(radius * 0.55).outerRadius(radius + 8);

    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.type))
      .range(data.map(d => Utils.PALETTE.outputTypes[d.type] || "#999"));

    // ---- Draw arcs ----
    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    g.selectAll("path")
      .data(pie(data))
      .join("path")
      .attr("d", arc)
      .attr("fill", d => color(d.data.type))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .on("mouseover", (event, d) => {
        d3.select(event.target).transition().duration(200).attr("d", arcHover);
        const pct = ((d.data.count / total) * 100).toFixed(1);
        Utils.showTooltip(tip, event,
          `<strong>${d.data.label}</strong><br>` +
          `${d.data.count} outputs (${pct}%)`);
      })
      .on("mouseout", (event) => {
        d3.select(event.target).transition().duration(200).attr("d", arc);
        Utils.hideTooltip(tip);
      })
      .transition(Utils.T())
      .attrTween("d", function(d) {
        const interp = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return t => arc(interp(t));
      });

    // ---- Center label ----
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .style("font-size", "24px")
      .style("font-weight", "700")
      .text(total);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .style("font-size", "12px")
      .style("fill", "#666")
      .text("total outputs");

    // ---- Legend ----
    Utils.addLegend(SELECTOR,
      data.map(d => ({ label: `${d.label} (${d.count})`, color: color(d.type) })));

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "Consider the value of ALL research outputs — including datasets " +
      "and software — not just publications (DORA Rec. #3 & #5).");
  }

  return { render };

})();
