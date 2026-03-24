/**
 * timeline.js — Publication Timeline (Stacked Bar Chart)
 *
 * Shows the number and type of research outputs per year.
 * DORA alignment: values ALL output types (datasets, software, etc.),
 * not just journal articles. Stacking makes the diversity visible.
 *
 * Inspired by: D3 Stacked Bar Chart (Observable @d3/stacked-bar-chart)
 */

const TimelineModule = (() => {

  const SELECTOR = "#viz-timeline";

  function render(publications) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Research Output Timeline");

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const { svg, width, height } = Utils.createSvg(SELECTOR, margin, 0.45);
    const tip = Utils.createTooltip();

    // ---- Data wrangling ----
    // Get all output types present in the data
    const types = [...new Set(publications.map(p => p.type))];
    const byYear = Utils.groupByYear(publications);
    const years = [...byYear.keys()].sort();

    // Build a matrix: for each year, count per type
    const stackData = years.map(year => {
      const row = { year };
      types.forEach(t => { row[t] = 0; });
      byYear.get(year).forEach(p => { row[p.type]++; });
      return row;
    });

    // ---- Scales ----
    const x = d3.scaleBand()
      .domain(years)
      .range([0, width])
      .padding(0.15);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stackData, d => types.reduce((s, t) => s + d[t], 0))])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(types)
      .range(types.map(t => Utils.PALETTE.outputTypes[t] || "#999"));

    // ---- Stack layout ----
    const stack = d3.stack().keys(types);
    const series = stack(stackData);

    // ---- Draw bars ----
    svg.selectAll("g.series")
      .data(series)
      .join("g")
      .attr("class", "series")
      .attr("fill", d => color(d.key))
      .selectAll("rect")
      .data(d => d.map(item => ({ ...item, key: d.key })))
      .join("rect")
      .attr("x", d => x(d.data.year))
      .attr("width", x.bandwidth())
      .attr("y", height)       // start at bottom for animation
      .attr("height", 0)
      .on("mouseover", (event, d) => {
        const count = d[1] - d[0];
        Utils.showTooltip(tip, event,
          `<strong>${d.data.year}</strong><br>` +
          `${Utils.formatType(d.key)}: ${count}`);
      })
      .on("mouseout", () => Utils.hideTooltip(tip))
      .transition(Utils.T())
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]));

    // ---- Axes ----
    Utils.addXAxis(svg, x, height, "Year");
    Utils.addYAxis(svg, y, "Number of Outputs");

    // ---- Legend ----
    Utils.addLegend(SELECTOR,
      types.map(t => ({ label: Utils.formatType(t), color: color(t) })));

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "Research impact extends beyond journal articles. Datasets, software, " +
      "and preprints are valued research outputs (DORA Rec. #3 & #5).");
  }

  return { render };

})();
