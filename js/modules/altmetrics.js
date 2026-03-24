/**
 * altmetrics.js — Alternative Attention Metrics (Bubble Chart)
 *
 * Each publication is a bubble, sized by citations, positioned by
 * social media attention (x) and scholarly downloads (y), colored by
 * output type. This reveals the disconnect between traditional and
 * alternative metrics — high-citation papers aren't always the most
 * socially discussed, and vice versa.
 *
 * DORA alignment: broadens the view of impact beyond citation counts.
 *
 * Inspired by: D3 Bubble Chart / Scatterplot (Observable @d3/bubble-chart)
 */

const AltmetricsModule = (() => {

  const SELECTOR = "#viz-altmetrics";

  function render(publications) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Attention Landscape: Traditional vs. Alternative Metrics");

    const margin = { top: 20, right: 20, bottom: 55, left: 60 };
    const { svg, width, height } = Utils.createSvg(SELECTOR, margin, 0.55);
    const tip = Utils.createTooltip();

    // ---- Data ----
    const data = publications.filter(p => p.citations > 0 || p.altmetrics.downloads > 0);

    // ---- Scales ----
    const x = d3.scaleLog()
      .domain([1, d3.max(data, d => d.altmetrics.twitter_mentions + 1)])
      .range([0, width])
      .clamp(true);

    const y = d3.scaleLog()
      .domain([1, d3.max(data, d => d.altmetrics.downloads + 1)])
      .range([height, 0])
      .clamp(true);

    const r = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d.citations)])
      .range([2, 18]);

    const color = d3.scaleOrdinal()
      .domain(Object.keys(Utils.PALETTE.outputTypes))
      .range(Object.values(Utils.PALETTE.outputTypes));

    // ---- Draw bubbles ----
    svg.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d.altmetrics.twitter_mentions + 1))
      .attr("cy", d => y(d.altmetrics.downloads + 1))
      .attr("r", 0)
      .attr("fill", d => color(d.type))
      .attr("opacity", 0.6)
      .attr("stroke", d => color(d.type))
      .attr("stroke-width", 1)
      .on("mouseover", (event, d) => {
        d3.select(event.target).attr("opacity", 1).attr("stroke-width", 2);
        Utils.showTooltip(tip, event,
          `<strong>${Utils.formatType(d.type)}</strong> (${d.year})<br>` +
          `Citations: ${d.citations}<br>` +
          `Downloads: ${d.altmetrics.downloads}<br>` +
          `Twitter: ${d.altmetrics.twitter_mentions}<br>` +
          `News: ${d.altmetrics.news_mentions}<br>` +
          `Policy: ${d.altmetrics.policy_citations}`);
      })
      .on("mouseout", (event) => {
        d3.select(event.target).attr("opacity", 0.6).attr("stroke-width", 1);
        Utils.hideTooltip(tip);
      })
      .transition(Utils.T())
      .delay((_, i) => i * 5)
      .attr("r", d => r(d.citations));

    // ---- Axes ----
    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5, "~s"));

    svg.append("text")
      .attr("class", "axis-label")
      .attr("x", width / 2).attr("y", height + 40)
      .attr("text-anchor", "middle")
      .text("Social Media Mentions (log scale)");

    svg.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(y).ticks(5, "~s"));

    svg.append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2).attr("y", -45)
      .attr("text-anchor", "middle")
      .text("Downloads (log scale)");

    // ---- Size legend ----
    svg.append("text")
      .attr("x", width - 80).attr("y", 10)
      .style("font-size", "10px").style("fill", "#666")
      .text("Bubble size = citations");

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "No single metric captures full impact. Social attention, downloads, " +
      "and policy influence each tell a different story (DORA Rec. #17).");
  }

  return { render };

})();
