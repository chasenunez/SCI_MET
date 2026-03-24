/**
 * collaboration.js — Co-Author Network (Force-Directed Graph)
 *
 * Visualizes the researcher's collaboration network as a node-link
 * diagram. Node size encodes number of co-authored outputs. Edge
 * thickness encodes collaboration frequency.
 *
 * DORA alignment: encourages responsible authorship practices and
 * understanding specific contributions (Rec. #8).
 *
 * Inspired by: D3 Force-Directed Graph (Observable @d3/force-directed-graph)
 */

const CollaborationModule = (() => {

  const SELECTOR = "#viz-collaboration";

  function render(publications, researcherName) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Collaboration Network");

    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const { svg, width, height } = Utils.createSvg(SELECTOR, margin, 0.6);
    const tip = Utils.createTooltip();

    // ---- Build graph data ----
    const coauthorCounts = {};
    const pairCounts = {};

    publications.forEach(pub => {
      pub.coauthors.forEach(ca => {
        coauthorCounts[ca] = (coauthorCounts[ca] || 0) + 1;
        // Edges between researcher and each coauthor
        const key = [researcherName, ca].sort().join("|||");
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      });
      // Edges between coauthor pairs within a paper
      for (let i = 0; i < pub.coauthors.length; i++) {
        for (let j = i + 1; j < pub.coauthors.length; j++) {
          const key = [pub.coauthors[i], pub.coauthors[j]].sort().join("|||");
          pairCounts[key] = (pairCounts[key] || 0) + 1;
        }
      }
    });

    // Build nodes (researcher + top collaborators)
    const topCollabs = Object.entries(coauthorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);  // Limit for readability

    const nodeNames = new Set([researcherName, ...topCollabs.map(d => d[0])]);
    const nodes = [...nodeNames].map(name => ({
      id: name,
      count: name === researcherName
        ? publications.length
        : (coauthorCounts[name] || 0),
      isCenter: name === researcherName,
    }));

    // Build edges
    const links = [];
    Object.entries(pairCounts).forEach(([key, weight]) => {
      const [source, target] = key.split("|||");
      if (nodeNames.has(source) && nodeNames.has(target)) {
        links.push({ source, target, weight });
      }
    });

    // ---- Scales ----
    const nodeScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, d => d.count)])
      .range([4, 22]);

    const linkScale = d3.scaleLinear()
      .domain([1, d3.max(links, d => d.weight) || 1])
      .range([1, 5]);

    // ---- Force simulation ----
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => nodeScale(d.count) + 3));

    // ---- Draw links ----
    const link = svg.selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#bbb")
      .attr("stroke-width", d => linkScale(d.weight))
      .attr("stroke-opacity", 0.6);

    // ---- Draw nodes ----
    const node = svg.selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => nodeScale(d.count))
      .attr("fill", d => d.isCenter ? "#D55E00" : "#0072B2")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", "grab")
      .on("mouseover", (event, d) => {
        Utils.showTooltip(tip, event,
          `<strong>${d.id}</strong><br>` +
          `${d.isCenter ? "Researcher" : "Collaborator"}<br>` +
          `Shared outputs: ${d.count}`);
      })
      .on("mouseout", () => Utils.hideTooltip(tip))
      .call(drag(simulation));

    // ---- Labels for larger nodes ----
    const label = svg.selectAll("text.node-label")
      .data(nodes.filter(d => d.isCenter || d.count >= 3))
      .join("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("dy", d => nodeScale(d.count) + 12)
      .style("font-size", "10px")
      .style("fill", "#333")
      .text(d => d.id.split(" ").pop()); // Last name only

    // ---- Tick ----
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      node
        .attr("cx", d => d.x = Math.max(10, Math.min(width - 10, d.x)))
        .attr("cy", d => d.y = Math.max(10, Math.min(height - 10, d.y)));
      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    // ---- Legend ----
    Utils.addLegend(SELECTOR, [
      { label: "Researcher", color: "#D55E00" },
      { label: "Collaborator", color: "#0072B2" },
    ]);

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "Encourage responsible authorship and understand specific " +
      "contributions of each collaborator (DORA Rec. #8).");
  }

  /** Drag behavior for force-directed nodes. */
  function drag(simulation) {
    return d3.drag()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
  }

  return { render };

})();
