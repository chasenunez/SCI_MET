/**
 * topicStream.js — Topic Evolution (Streamgraph)
 *
 * Visualizes how research topics shift over a career using a
 * streamgraph — a stacked area chart with a flowing, organic shape.
 * This reveals thematic breadth and intellectual evolution, neither
 * of which is captured by citation metrics.
 *
 * Inspired by: D3 Streamgraph (Observable @d3/streamgraph)
 */

const TopicStreamModule = (() => {

  const SELECTOR = "#viz-topic-stream";

  function render(publications) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Research Topic Evolution");

    const margin = { top: 20, right: 20, bottom: 50, left: 50 };
    const { svg, width, height } = Utils.createSvg(SELECTOR, margin, 0.4);
    const tip = Utils.createTooltip();

    // ---- Extract topics ----
    const allTopics = new Set();
    publications.forEach(p => p.topics.forEach(t => allTopics.add(t)));

    // Keep the top N topics for readability
    const topicCounts = {};
    publications.forEach(p => p.topics.forEach(t => {
      topicCounts[t] = (topicCounts[t] || 0) + 1;
    }));
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(d => d[0]);

    // ---- Build data matrix ----
    const byYear = Utils.groupByYear(publications);
    const years = [...byYear.keys()].sort();

    const stackData = years.map(year => {
      const row = { year };
      topTopics.forEach(t => { row[t] = 0; });
      (byYear.get(year) || []).forEach(p => {
        p.topics.forEach(t => {
          if (topTopics.includes(t)) row[t]++;
        });
      });
      return row;
    });

    // ---- Scales ----
    const x = d3.scaleLinear()
      .domain(d3.extent(years))
      .range([0, width]);

    const stack = d3.stack()
      .keys(topTopics)
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut);

    const series = stack(stackData);

    const y = d3.scaleLinear()
      .domain([
        d3.min(series, s => d3.min(s, d => d[0])),
        d3.max(series, s => d3.max(s, d => d[1])),
      ])
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(topTopics)
      .range(Utils.PALETTE.categorical);

    // ---- Draw streams ----
    const area = d3.area()
      .x(d => x(d.data.year))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveBasis);

    svg.selectAll("path.stream")
      .data(series)
      .join("path")
      .attr("class", "stream")
      .attr("d", area)
      .attr("fill", d => color(d.key))
      .attr("opacity", 0.8)
      .on("mouseover", (event, d) => {
        svg.selectAll("path.stream").attr("opacity", 0.3);
        d3.select(event.target).attr("opacity", 1);
        const total = d3.sum(d, v => v[1] - v[0]);
        Utils.showTooltip(tip, event,
          `<strong>${d.key}</strong><br>` +
          `Total appearances: ${total.toFixed(0)}`);
      })
      .on("mouseout", () => {
        svg.selectAll("path.stream").attr("opacity", 0.8);
        Utils.hideTooltip(tip);
      });

    // ---- X axis only (Y is meaningless in wiggle offset) ----
    Utils.addXAxis(svg, x, height, "Year", true);

    // ---- Legend ----
    Utils.addLegend(SELECTOR,
      topTopics.map(t => ({ label: t, color: color(t) })));

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "Scientific content and thematic depth matter more than where " +
      "work is published. Evaluate the substance (DORA Rec. #2 & #15).");
  }

  return { render };

})();
