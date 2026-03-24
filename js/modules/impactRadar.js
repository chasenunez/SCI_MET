/**
 * impactRadar.js — Multi-Dimensional Impact Profile (Radar Chart)
 *
 * Displays a researcher's impact across multiple dimensions on a
 * radar/spider chart. DORA explicitly recommends using "a broad range
 * of impact measures including qualitative indicators" (Rec. #3 & #5).
 *
 * Dimensions: Citations, Downloads, Social Media, News, Policy, Open Access
 *
 * Inspired by: D3 Radar Chart patterns
 */

const ImpactRadarModule = (() => {

  const SELECTOR = "#viz-impact-radar";

  // The dimensions we measure — each normalized to 0–1 against a reference
  const DIMENSIONS = [
    { key: "citations", label: "Citations" },
    { key: "downloads", label: "Downloads" },
    { key: "social",    label: "Social Media" },
    { key: "news",      label: "News Mentions" },
    { key: "policy",    label: "Policy Impact" },
    { key: "openaccess", label: "Open Access %" },
  ];

  function render(publications) {
    const container = d3.select(SELECTOR);
    container.selectAll("*").remove();
    container.append("h3").text("Multi-Dimensional Impact Profile");

    const margin = { top: 30, right: 30, bottom: 30, left: 30 };
    const { svg, width, height } = Utils.createSvg(SELECTOR, margin, 0.7);
    const tip = Utils.createTooltip();

    // ---- Compute aggregate metrics ----
    const totalCitations = d3.sum(publications, d => d.citations);
    const totalDownloads = d3.sum(publications, d => d.altmetrics.downloads);
    const totalSocial = d3.sum(publications, d => d.altmetrics.twitter_mentions);
    const totalNews = d3.sum(publications, d => d.altmetrics.news_mentions);
    const totalPolicy = d3.sum(publications, d => d.altmetrics.policy_citations);
    const oaPct = publications.filter(d => d.open_access).length / publications.length;

    // Normalize each dimension to 0–1 using reasonable reference maxima
    const n = publications.length || 1;
    const values = [
      Math.min(1, (totalCitations / n) / 50),      // ~50 cit/paper is high
      Math.min(1, (totalDownloads / n) / 500),      // ~500 downloads/paper
      Math.min(1, (totalSocial / n) / 100),         // ~100 tweets/paper
      Math.min(1, (totalNews / n) / 10),             // ~10 news/paper
      Math.min(1, (totalPolicy / n) / 3),            // ~3 policy/paper
      oaPct,                                          // Already 0–1
    ];

    // ---- Radar geometry ----
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 20;
    const angleSlice = (2 * Math.PI) / DIMENSIONS.length;

    const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

    // ---- Concentric grid circles ----
    const levels = 5;
    for (let i = 1; i <= levels; i++) {
      const r = (radius / levels) * i;
      g.append("circle")
        .attr("r", r)
        .attr("fill", "none")
        .attr("stroke", "#ddd")
        .attr("stroke-dasharray", "3,3");
      // Level labels
      g.append("text")
        .attr("x", 4).attr("y", -r)
        .style("font-size", "9px").style("fill", "#aaa")
        .text(`${((i / levels) * 100).toFixed(0)}%`);
    }

    // ---- Axis lines and labels ----
    DIMENSIONS.forEach((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x2 = radius * Math.cos(angle);
      const y2 = radius * Math.sin(angle);

      g.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", x2).attr("y2", y2)
        .attr("stroke", "#ccc").attr("stroke-width", 1);

      // Label
      const labelR = radius + 18;
      g.append("text")
        .attr("x", labelR * Math.cos(angle))
        .attr("y", labelR * Math.sin(angle))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .text(dim.label);
    });

    // ---- Radar polygon ----
    const radarLine = d3.lineRadial()
      .radius((d, i) => d * radius)
      .angle((d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    // Area fill
    g.append("path")
      .datum(values)
      .attr("d", radarLine)
      .attr("fill", Utils.PALETTE.categorical[0])
      .attr("fill-opacity", 0.25)
      .attr("stroke", Utils.PALETTE.categorical[0])
      .attr("stroke-width", 2);

    // ---- Data points ----
    values.forEach((val, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const px = val * radius * Math.cos(angle);
      const py = val * radius * Math.sin(angle);

      g.append("circle")
        .attr("cx", px).attr("cy", py)
        .attr("r", 5)
        .attr("fill", Utils.PALETTE.categorical[0])
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .on("mouseover", (event) => {
          const raw = [totalCitations, totalDownloads, totalSocial,
                       totalNews, totalPolicy,
                       `${(oaPct * 100).toFixed(0)}%`];
          Utils.showTooltip(tip, event,
            `<strong>${DIMENSIONS[i].label}</strong><br>` +
            `Value: ${raw[i]}<br>` +
            `Normalized: ${(val * 100).toFixed(0)}%`);
        })
        .on("mouseout", () => Utils.hideTooltip(tip));
    });

    // ---- DORA note ----
    Utils.addDORANote(SELECTOR,
      "Use a broad range of impact measures including qualitative " +
      "indicators such as influence on policy and practice (DORA Rec. #3 & #17).");
  }

  return { render };

})();
