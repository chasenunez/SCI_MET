import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Download,
  RefreshCw,
  Search,
  BarChart3,
  Network,
  Newspaper,
  Users,
  Filter,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const TARGET_INSTITUTIONS = [
  { label: "ETH Zurich", aliases: ["ETHZ", "ETH Zurich", "ETH Zürich"] },
  { label: "EPFL", aliases: ["EPFL", "École polytechnique fédérale de Lausanne"] },
  { label: "Eawag", aliases: ["Eawag", "Swiss Federal Institute of Aquatic Science and Technology"] },
  { label: "Empa", aliases: ["Empa", "Swiss Federal Laboratories for Materials Science and Technology"] },
  { label: "PSI", aliases: ["PSI", "Paul Scherrer Institute", "Pauls Scherer Institute"] },
  { label: "WSL", aliases: ["WSL", "Swiss Federal Institute for Forest, Snow and Landscape Research"] },
];

// A small enrichment layer for journal impact factors.
// In production, wire this to a curated CSV or JCR/Scimago lookup table.
const JOURNAL_IMPACT = {
  Nature: 64.8,
  Science: 56.9,
  "Nature Communications": 16.6,
  PNAS: 11.1,
  Cell: 45.5,
  "The Lancet": 98.4,
  "ACS Nano": 17.1,
  "Advanced Materials": 29.4,
  "Environmental Science & Technology": 11.4,
  "Applied Catalysis B: Environmental": 22.1,
};

const SOURCES_SOCIAL = new Set(["twitter", "reddit", "stackexchange", "wordpress.com", "web"]);
const SOURCES_NEWS = new Set(["newsfeed"]);

function normalizeString(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function sum(arr, accessor = (d) => d) {
  return arr.reduce((acc, d) => acc + (+accessor(d) || 0), 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value || 0);
}

function formatShort(value) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function yearRangeFromWorks(works) {
  const years = works.map((d) => d.year).filter(Boolean);
  if (!years.length) return [2015, new Date().getFullYear()];
  return [Math.min(...years), Math.max(...years)];
}

function hIndex(citations) {
  const sorted = [...citations].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

function downloadFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function useSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return undefined;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function SectionCard({ title, icon: Icon, subtitle, children, right }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
            <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
          </div>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, hint, accent = false }) {
  return (
    <div className={`rounded-3xl border ${accent ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white"} p-4 shadow-sm`}>
      <div className={`text-xs uppercase tracking-wide ${accent ? "text-slate-300" : "text-slate-500"}`}>{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className={`mt-1 text-xs ${accent ? "text-slate-300" : "text-slate-500"}`}>{hint}</div> : null}
    </div>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function YearTimelineChart({ data, selectedYear, onYearSelect }) {
  const ref = useRef(null);
  const { width, height } = useSize(ref);
  const svgRef = useRef(null);
  const margin = { top: 20, right: 60, bottom: 38, left: 44 };
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!width || !height || !svgRef.current || !data.length) return;

    const w = width - margin.left - margin.right;
    const h = Math.max(280, height) - margin.top - margin.bottom;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const years = data.map((d) => d.year);
    const x = d3.scaleBand().domain(years).range([0, w]).padding(0.2);
    const yPub = d3.scaleLinear().domain([0, d3.max(data, (d) => d.publications) || 1]).nice().range([h, 0]);
    const yCit = d3.scaleLinear().domain([0, d3.max(data, (d) => d.citations) || 1]).nice().range([h, 0]);

    const g = svg.attr("viewBox", `0 0 ${width} ${Math.max(280, height)}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues(years.filter((_, i) => i % Math.max(1, Math.ceil(years.length / 8)) === 0)))
      .call((sel) => sel.selectAll("text").attr("fill", "#64748b").attr("font-size", 11))
      .call((sel) => sel.selectAll("path,line").attr("stroke", "#cbd5e1"));

    g.append("g")
      .call(d3.axisLeft(yPub).ticks(5))
      .call((sel) => sel.selectAll("text").attr("fill", "#64748b").attr("font-size", 11))
      .call((sel) => sel.selectAll("path,line").attr("stroke", "#cbd5e1"));

    g.append("g")
      .attr("transform", `translate(${w},0)`)
      .call(d3.axisRight(yCit).ticks(5))
      .call((sel) => sel.selectAll("text").attr("fill", "#64748b").attr("font-size", 11))
      .call((sel) => sel.selectAll("path,line").attr("stroke", "#cbd5e1"));

    g.append("text").attr("x", 0).attr("y", -6).attr("fill", "#64748b").attr("font-size", 11).text("Publications / year");
    g.append("text").attr("x", w).attr("y", -6).attr("text-anchor", "end").attr("fill", "#64748b").attr("font-size", 11).text("Citations / year");

    const bars = g
      .selectAll("rect.pub")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "pub")
      .attr("x", (d) => x(d.year))
      .attr("y", (d) => yPub(d.publications))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - yPub(d.publications))
      .attr("rx", 8)
      .attr("fill", (d) => (d.year === selectedYear ? "#0f172a" : "#94a3b8"))
      .attr("opacity", 0.9)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("opacity", 1);
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.opacity = 1;
          tip.style.left = `${event.offsetX + 16}px`;
          tip.style.top = `${event.offsetY - 12}px`;
          tip.innerHTML = `<div class=\"font-semibold\">${d.year}</div><div>Publications: ${formatNumber(d.publications)}</div><div>Citations: ${formatNumber(d.citations)}</div>`;
        }
      })
      .on("mousemove", function (event) {
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.left = `${event.offsetX + 16}px`;
          tip.style.top = `${event.offsetY - 12}px`;
        }
      })
      .on("mouseleave", function () {
        d3.select(this).attr("opacity", 0.9);
        const tip = tooltipRef.current;
        if (tip) tip.style.opacity = 0;
      })
      .on("click", (_, d) => onYearSelect?.(d.year));

    const line = d3
      .line()
      .x((d) => x(d.year) + x.bandwidth() / 2)
      .y((d) => yCit(d.citations))
      .curve(d3.curveMonotoneX);

    g.append("path").datum(data).attr("fill", "none").attr("stroke", "#2563eb").attr("stroke-width", 3).attr("d", line);

    g.selectAll("circle.cit")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "cit")
      .attr("cx", (d) => x(d.year) + x.bandwidth() / 2)
      .attr("cy", (d) => yCit(d.citations))
      .attr("r", 4)
      .attr("fill", (d) => (d.year === selectedYear ? "#0f172a" : "#2563eb"))
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("r", 6);
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.opacity = 1;
          tip.style.left = `${event.offsetX + 16}px`;
          tip.style.top = `${event.offsetY - 12}px`;
          tip.innerHTML = `<div class=\"font-semibold\">${d.year}</div><div>Publications: ${formatNumber(d.publications)}</div><div>Citations: ${formatNumber(d.citations)}</div>`;
        }
      })
      .on("mousemove", function (event) {
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.left = `${event.offsetX + 16}px`;
          tip.style.top = `${event.offsetY - 12}px`;
        }
      })
      .on("mouseleave", function () {
        d3.select(this).attr("r", 4);
        const tip = tooltipRef.current;
        if (tip) tip.style.opacity = 0;
      })
      .on("click", (_, d) => onYearSelect?.(d.year));
  }, [data, width, height, selectedYear, onYearSelect]);

  return (
    <div ref={ref} className="relative h-[380px] w-full">
      <svg ref={svgRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
        style={{ opacity: 0 }}
      />
      <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
        Bars = publications, line = citations
      </div>
    </div>
  );
}

function CitationHistogram({ data, onSelectBin }) {
  const ref = useRef(null);
  const { width, height } = useSize(ref);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const margin = { top: 14, right: 14, bottom: 40, left: 36 };

  useEffect(() => {
    if (!width || !height || !data.length || !svgRef.current) return;
    const w = width - margin.left - margin.right;
    const h = Math.max(220, height) - margin.top - margin.bottom;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const x = d3.scaleBand().domain(data.map((d) => d.label)).range([0, w]).padding(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.count) || 1]).nice().range([h, 0]);

    const g = svg.attr("viewBox", `0 0 ${width} ${Math.max(220, height)}`).append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    g.append("g")
      .attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x).tickValues(x.domain().filter((_, i) => i % Math.max(1, Math.ceil(x.domain().length / 8)) === 0)))
      .call((sel) => sel.selectAll("text").attr("font-size", 10).attr("fill", "#64748b"))
      .call((sel) => sel.selectAll("path,line").attr("stroke", "#cbd5e1"));

    g.append("g")
      .call(d3.axisLeft(y).ticks(4))
      .call((sel) => sel.selectAll("text").attr("font-size", 10).attr("fill", "#64748b"))
      .call((sel) => sel.selectAll("path,line").attr("stroke", "#cbd5e1"));

    g.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.label))
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - y(d.count))
      .attr("rx", 7)
      .attr("fill", "#475569")
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("fill", "#0f172a");
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.opacity = 1;
          tip.style.left = `${event.offsetX + 16}px`;
          tip.style.top = `${event.offsetY - 12}px`;
          tip.innerHTML = `<div class=\"font-semibold\">${d.label} citations</div><div>Papers: ${formatNumber(d.count)}</div>`;
        }
      })
      .on("mousemove", function (event) {
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.left = `${event.offsetX + 16}px`;
          tip.style.top = `${event.offsetY - 12}px`;
        }
      })
      .on("mouseleave", function () {
        d3.select(this).attr("fill", "#475569");
        const tip = tooltipRef.current;
        if (tip) tip.style.opacity = 0;
      })
      .on("click", (_, d) => onSelectBin?.(d.label));
  }, [data, width, height, onSelectBin]);

  return (
    <div ref={ref} className="relative h-[320px] w-full">
      <svg ref={svgRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
        style={{ opacity: 0 }}
      />
    </div>
  );
}

function NetworkGraph({ graph, onSelectAuthor }) {
  const ref = useRef(null);
  const { width, height } = useSize(ref);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!width || !height || !graph.nodes.length || !svgRef.current) return;
    const w = width;
    const h = Math.max(340, height);
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);

    const root = svg.append("g");
    const zoomLayer = root.append("g");
    svg.call(d3.zoom().scaleExtent([0.4, 3]).on("zoom", (event) => zoomLayer.attr("transform", event.transform)));

    const sim = d3
      .forceSimulation(graph.nodes)
      .force("link", d3.forceLink(graph.links).id((d) => d.id).distance((d) => 60 + Math.max(0, 120 - d.weight * 12)))
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collision", d3.forceCollide().radius((d) => 12 + Math.min(12, d.degree * 1.2)));

    const link = zoomLayer
      .append("g")
      .selectAll("line")
      .data(graph.links)
      .enter()
      .append("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", (d) => Math.max(1, Math.sqrt(d.weight)));

    const node = zoomLayer
      .append("g")
      .selectAll("g")
      .data(graph.nodes)
      .enter()
      .append("g")
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).select("circle").attr("stroke", "#0f172a").attr("stroke-width", 3);
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.opacity = 1;
          tip.style.left = `${event.offsetX + 16}px`;
          tip.style.top = `${event.offsetY - 12}px`;
          tip.innerHTML = `<div class=\"font-semibold\">${d.id}</div><div>Works: ${formatNumber(d.works)}</div><div>Collaborations: ${formatNumber(d.degree)}</div>`;
        }
      })
      .on("mousemove", function (event) {
        const tip = tooltipRef.current;
        if (tip) {
          tip.style.left = `${event.offsetX + 16}px`;
          tip.style.top = `${event.offsetY - 12}px`;
        }
      })
      .on("mouseleave", function () {
        d3.select(this).select("circle").attr("stroke", "#ffffff").attr("stroke-width", 1.5);
        const tip = tooltipRef.current;
        if (tip) tip.style.opacity = 0;
      })
      .on("click", (_, d) => onSelectAuthor?.(d.id));

    node
      .append("circle")
      .attr("r", (d) => 7 + Math.min(12, d.degree * 1.2))
      .attr("fill", (d) => (d.focus ? "#0f172a" : d.communityColor || "#64748b"))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5);

    node
      .append("text")
      .text((d) => d.id)
      .attr("x", 10)
      .attr("y", 4)
      .attr("font-size", 11)
      .attr("fill", "#334155");

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);
      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [graph, width, height, onSelectAuthor]);

  return (
    <div ref={ref} className="relative h-[520px] w-full rounded-3xl border border-slate-200 bg-white">
      <svg ref={svgRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
        style={{ opacity: 0 }}
      />
    </div>
  );
}

function buildFallbackWorks() {
  const journals = ["Nature", "Science", "Nature Communications", "PNAS", "Environmental Science & Technology", "Advanced Materials", "ACS Nano"];
  const fields = ["Materials Science", "Environmental Science", "Physics", "Computer Science", "Biology", "Chemistry"];
  const authors = ["A. Müller", "L. Rossi", "J. Wang", "S. Keller", "M. Smith", "A. Patel", "C. Dubois", "N. Meyer", "P. Meier", "T. Nguyen"];
  const works = [];
  let id = 1;
  for (let year = 2014; year <= new Date().getFullYear(); year += 1) {
    const n = 10 + ((year * 7) % 14);
    for (let i = 0; i < n; i += 1) {
      const paperAuthors = d3.shuffle([...authors]).slice(0, 2 + ((i + year) % 4));
      works.push({
        id: `demo-${id++}`,
        title: `Research outcome ${id}`,
        doi: i % 3 === 0 ? `10.5555/demo.${year}.${i}` : null,
        year,
        citations: Math.max(0, Math.round((year - 2012) * 1.8 + i * 2 + (i % 5) * 3)),
        journal: journals[(i + year) % journals.length],
        impactFactor: JOURNAL_IMPACT[journals[(i + year) % journals.length]] || null,
        authors: paperAuthors,
        field: fields[(i + year) % fields.length],
        institution: TARGET_INSTITUTIONS[(i + year) % TARGET_INSTITUTIONS.length].label,
        source: "demo",
      });
    }
  }
  return works;
}

async function resolveOpenAlexInstitution(aliases) {
  for (const alias of aliases) {
    try {
      const url = `https://api.openalex.org/institutions?search=${encodeURIComponent(alias)}&per-page=5`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const json = await resp.json();
      const results = json?.results || [];
      const exact = results.find((r) => normalizeString(r.display_name) === normalizeString(alias));
      if (exact) return exact;
      if (results[0]) return results[0];
    } catch (err) {
      // continue
    }
  }
  return null;
}

async function fetchOpenAlexWorksForInstitution(institutionId, startYear, endYear, maxWorks = 350) {
  const out = [];
  let cursor = "*";
  while (cursor && out.length < maxWorks) {
    const url = `https://api.openalex.org/works?filter=institutions.id:${institutionId},publication_year:${startYear}-${endYear}&per-page=200&cursor=${encodeURIComponent(cursor)}`;
    const resp = await fetch(url);
    if (!resp.ok) break;
    const json = await resp.json();
    const results = json?.results || [];
    out.push(...results);
    cursor = json?.meta?.next_cursor || null;
    if (results.length < 200) break;
  }
  return out.slice(0, maxWorks);
}

function normalizeOpenAlexWork(work, institutionLabel) {
  const journal = work?.primary_location?.source?.display_name || work?.host_venue?.display_name || "Unknown journal";
  const doiRaw = work?.doi || work?.ids?.doi || null;
  const doi = doiRaw ? doiRaw.replace(/^https?:\/\/doi\.org\//i, "").trim() : null;
  const authors = (work?.authorships || [])
    .map((a) => a?.author?.display_name)
    .filter(Boolean);
  const primaryField = work?.primary_topic?.field?.display_name || work?.primary_topic?.display_name || "Unspecified";
  const year = work?.publication_year || (work?.publication_date ? Number(String(work.publication_date).slice(0, 4)) : null);
  return {
    id: work?.id || doi || `${institutionLabel}-${work?.display_name}`,
    title: work?.display_name || work?.title || "Untitled work",
    doi,
    year,
    citations: work?.cited_by_count || 0,
    journal,
    impactFactor: JOURNAL_IMPACT[journal] || JOURNAL_IMPACT[normalizeString(journal)] || null,
    authors,
    field: primaryField,
    institution: institutionLabel,
    source: "openalex",
  };
}

async function fetchCrossrefEventsForDoi(doi) {
  if (!doi) return { total: 0, bySource: {} };
  const idsToTry = [doi, `https://doi.org/${doi}`];
  for (const objId of idsToTry) {
    try {
      const url = `https://api.eventdata.crossref.org/v1/events?obj-id=${encodeURIComponent(objId)}&rows=1000`;
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const json = await resp.json();
      const events = json?.events || [];
      const bySource = d3.rollups(events, (v) => v.length, (d) => d.source_id || "unknown");
      return {
        total: events.length,
        bySource: Object.fromEntries(bySource),
      };
    } catch (err) {
      // continue
    }
  }
  return { total: 0, bySource: {} };
}

export default function ScientometricDashboard() {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading live scientometric data...");
  const [works, setWorks] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState("All authors");
  const [selectedField, setSelectedField] = useState("All fields");
  const [selectedPaperId, setSelectedPaperId] = useState(null);
  const [altmetrics, setAltmetrics] = useState({ total: 0, bySource: {} });
  const [expandedInstitutions, setExpandedInstitutions] = useState(true);
  const [yearBounds, setYearBounds] = useState([2014, new Date().getFullYear()]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setStatus("Resolving institutions and fetching works from OpenAlex...");
      try {
        const resolved = [];
        for (const inst of TARGET_INSTITUTIONS) {
          const resolvedInst = await resolveOpenAlexInstitution(inst.aliases);
          if (resolvedInst) {
            resolved.push({ name: inst.label, openalex: resolvedInst });
          }
        }

        const liveWorks = [];
        for (const item of resolved) {
          setStatus(`Fetching works for ${item.name}...`);
          const fetched = await fetchOpenAlexWorksForInstitution(item.openalex.id.replace("https://openalex.org/", ""), yearBounds[0], yearBounds[1], 250);
          liveWorks.push(...fetched.map((w) => normalizeOpenAlexWork(w, item.name)));
        }

        const deduped = uniqBy(liveWorks, (d) => d.id);
        const withYear = deduped.filter((d) => d.year);
        if (!cancelled) {
          if (withYear.length) {
            setWorks(withYear);
            const range = yearRangeFromWorks(withYear);
            setYearBounds(range);
            setStatus(`Loaded ${formatNumber(withYear.length)} works across ${resolved.length} institutions.`);
          } else {
            const fallback = buildFallbackWorks();
            setWorks(fallback);
            const range = yearRangeFromWorks(fallback);
            setYearBounds(range);
            setStatus("No live works returned. Showing bundled demo data so the dashboard stays usable.");
          }
        }
      } catch (err) {
        if (!cancelled) {
          const fallback = buildFallbackWorks();
          setWorks(fallback);
          const range = yearRangeFromWorks(fallback);
          setYearBounds(range);
          setStatus("Live fetch failed. Showing bundled demo data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = useMemo(() => {
    const filtered = works.filter((d) => {
      const yearOk = d.year >= yearBounds[0] && d.year <= yearBounds[1];
      const authorOk = selectedAuthor === "All authors" || d.authors.includes(selectedAuthor);
      const fieldOk = selectedField === "All fields" || d.field === selectedField;
      return yearOk && authorOk && fieldOk;
    });

    const years = d3.range(yearBounds[0], yearBounds[1] + 1);
    const yearSeries = years.map((year) => {
      const items = filtered.filter((d) => d.year === year);
      return {
        year,
        publications: items.length,
        citations: sum(items, (d) => d.citations),
      };
    });

    const citations = filtered.map((d) => d.citations);
    const h = hIndex(citations);
    const totalCitations = sum(filtered, (d) => d.citations);
    const totalPapers = filtered.length;
    const avgCitations = totalPapers ? totalCitations / totalPapers : 0;

    const histMax = d3.max(citations) || 1;
    const bins = d3
      .bin()
      .domain([0, histMax])
      .thresholds(d3.thresholdScott(citations) || 8)(citations)
      .map((bin) => ({
        label: `${Math.round(bin.x0)}–${Math.round(bin.x1)}`,
        count: bin.length,
        x0: bin.x0,
        x1: bin.x1,
      }));

    const authors = Object.entries(
      filtered.reduce((acc, work) => {
        work.authors.forEach((name) => {
          acc[name] = (acc[name] || 0) + 1;
        });
        return acc;
      }, {})
    )
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const fields = Array.from(new Set(filtered.map((d) => d.field).filter(Boolean))).sort();

    const journals = Object.values(
      filtered.reduce((acc, work) => {
        const key = work.journal || "Unknown journal";
        if (!acc[key]) {
          acc[key] = { journal: key, papers: 0, citations: 0, impactFactor: work.impactFactor || null };
        }
        acc[key].papers += 1;
        acc[key].citations += work.citations || 0;
        if (!acc[key].impactFactor && work.impactFactor) acc[key].impactFactor = work.impactFactor;
        return acc;
      }, {})
    )
      .map((j) => ({
        ...j,
        avgCitations: j.papers ? j.citations / j.papers : 0,
      }))
      .sort((a, b) => b.papers - a.papers || b.citations - a.citations)
      .slice(0, 14);

    const topPapers = [...filtered].sort((a, b) => b.citations - a.citations).slice(0, 15);

    const authorName = selectedAuthor === "All authors" ? authors[0]?.name || null : selectedAuthor;
    const graphWorks = filtered.slice().sort((a, b) => b.citations - a.citations).slice(0, 120);
    const nodeMap = new Map();
    const linkMap = new Map();

    graphWorks.forEach((work) => {
      const uniqueAuthors = [...new Set(work.authors)].slice(0, 8);
      uniqueAuthors.forEach((author) => {
        if (!nodeMap.has(author)) nodeMap.set(author, { id: author, works: 0, degree: 0, focus: author === authorName, communityColor: null });
        nodeMap.get(author).works += 1;
      });
      for (let i = 0; i < uniqueAuthors.length; i += 1) {
        for (let j = i + 1; j < uniqueAuthors.length; j += 1) {
          const a = uniqueAuthors[i];
          const b = uniqueAuthors[j];
          const key = a < b ? `${a}||${b}` : `${b}||${a}`;
          if (!linkMap.has(key)) linkMap.set(key, { source: a, target: b, weight: 0 });
          linkMap.get(key).weight += 1;
        }
      }
    });

    const nodes = [...nodeMap.values()];
    const links = [...linkMap.values()];
    const degreeByName = new Map(nodes.map((n) => [n.id, 0]));
    links.forEach((l) => {
      degreeByName.set(l.source, (degreeByName.get(l.source) || 0) + l.weight);
      degreeByName.set(l.target, (degreeByName.get(l.target) || 0) + l.weight);
    });
    nodes.forEach((n) => {
      n.degree = degreeByName.get(n.id) || 0;
      n.focus = n.id === authorName;
    });

    const palette = d3.scaleOrdinal(d3.schemeTableau10);
    nodes.forEach((n) => {
      const bucket = normalizeString(n.id).charCodeAt(0) || 0;
      n.communityColor = palette(bucket % 10);
    });

    const graph = {
      nodes: nodes.sort((a, b) => b.degree - a.degree).slice(0, 40),
      links: links.filter((l) => nodes.some((n) => n.id === l.source) && nodes.some((n) => n.id === l.target)).slice(0, 80),
    };

    const topPaper = selectedPaperId ? filtered.find((d) => d.id === selectedPaperId) || topPapers[0] || null : topPapers[0] || null;

    return {
      filtered,
      yearSeries,
      citations,
      h,
      totalPapers,
      totalCitations,
      avgCitations,
      bins,
      authors,
      fields,
      journals,
      topPapers,
      graph,
      selectedPaper: topPaper,
    };
  }, [works, yearBounds, selectedAuthor, selectedField, selectedPaperId]);

  useEffect(() => {
    if (!selectedPaperId && derived.selectedPaper) {
      setSelectedPaperId(derived.selectedPaper.id);
    }
  }, [derived.selectedPaper, selectedPaperId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAltmetrics() {
      const doi = derived.selectedPaper?.doi;
      if (!doi) {
        setAltmetrics({ total: 0, bySource: {} });
        return;
      }
      const result = await fetchCrossrefEventsForDoi(doi);
      if (!cancelled) setAltmetrics(result);
    }
    if (derived.selectedPaper) loadAltmetrics();
    return () => {
      cancelled = true;
    };
  }, [derived.selectedPaper?.doi]);

  const sourceCount = Object.entries(altmetrics.bySource || {}).reduce(
    (acc, [k, v]) => {
      const key = (k || "unknown").toLowerCase();
      if (SOURCES_SOCIAL.has(key)) acc.social += v;
      else if (SOURCES_NEWS.has(key)) acc.news += v;
      else acc.other += v;
      return acc;
    },
    { social: 0, news: 0, other: 0 }
  );

  const visiblePapers = derived.filtered;

  function exportCSV() {
    const rows = [
      ["title", "doi", "year", "citations", "journal", "impact_factor", "field", "authors", "institution"],
      ...visiblePapers.map((d) => [
        d.title,
        d.doi || "",
        d.year,
        d.citations,
        d.journal,
        d.impactFactor ?? "",
        d.field,
        d.authors.join("; "),
        d.institution,
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    downloadFile(`scientometrics_${yearBounds[0]}_${yearBounds[1]}.csv`, csv, "text/csv");
  }

  function exportJSON() {
    downloadFile(
      `scientometrics_${yearBounds[0]}_${yearBounds[1]}.json`,
      JSON.stringify({ filters: { yearBounds, selectedAuthor, selectedField }, papers: visiblePapers }, null, 2),
      "application/json"
    );
  }

  const authorOptions = ["All authors", ...derived.authors.slice(0, 25).map((d) => d.name)];
  const fieldOptions = ["All fields", ...derived.fields.slice(0, 20)];

  const minYear = yearRangeFromWorks(works)[0] || yearBounds[0];
  const maxYear = yearRangeFromWorks(works)[1] || yearBounds[1];

  const timeSeriesData = derived.yearSeries.filter((d) => d.year >= yearBounds[0] && d.year <= yearBounds[1]);

  const selectedPaper = derived.selectedPaper;
  const journalDisplayRows = derived.journals.map((j) => ({
    ...j,
    label: j.journal,
    ifText: j.impactFactor ? j.impactFactor.toFixed(1) : "—",
  }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-slate-800 px-6 py-5 text-white shadow-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                <BarChart3 className="h-3.5 w-3.5" /> Scientometric dashboard
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Research output, citation impact, and collaboration map</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Live data is pulled from OpenAlex for affiliated works, Crossref Event Data for attention signals, and a journal-metrics enrichment layer for impact factors.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-full bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600">
                <Download className="h-4 w-4" /> CSV
              </button>
              <button onClick={exportJSON} className="inline-flex items-center gap-2 rounded-full bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600">
                <Download className="h-4 w-4" /> JSON
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <div className="text-[11px] uppercase tracking-wide text-slate-300">Status</div>
              <div className="mt-1 text-sm text-white">{loading ? "Loading" : "Ready"}</div>
              <div className="mt-1 text-xs text-slate-300">{status}</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <div className="text-[11px] uppercase tracking-wide text-slate-300">Filter window</div>
              <div className="mt-1 text-sm text-white">
                {yearBounds[0]}–{yearBounds[1]}
              </div>
              <div className="mt-1 text-xs text-slate-300">Adjust to focus on a publication era.</div>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <div className="text-[11px] uppercase tracking-wide text-slate-300">Institutions</div>
              <div className="mt-1 text-sm text-white">{TARGET_INSTITUTIONS.map((d) => d.label).join(" · ")}</div>
              <button onClick={() => setExpandedInstitutions((v) => !v)} className="mt-1 inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white">
                {expandedInstitutions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {expandedInstitutions ? "Hide scope" : "Show scope"}
              </button>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
              <div className="text-[11px] uppercase tracking-wide text-slate-300">Most selected paper</div>
              <div className="mt-1 line-clamp-2 text-sm text-white">{selectedPaper?.title || "—"}</div>
              <div className="mt-1 text-xs text-slate-300">Click any paper in the right panel to update the altmetrics view.</div>
            </div>
          </div>
        </div>

        {expandedInstitutions ? (
          <div className="mt-4 flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            {TARGET_INSTITUTIONS.map((inst) => (
              <div key={inst.label} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                {inst.label}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-slate-900">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide">Filters</h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Year, author, and field filters drive every chart below.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-3 lg:min-w-[52%]">
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-500">Start year</div>
                    <input
                      type="number"
                      min={minYear}
                      max={yearBounds[1]}
                      value={yearBounds[0]}
                      onChange={(e) => setYearBounds([Math.min(Number(e.target.value) || minYear, yearBounds[1]), yearBounds[1]])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-500">End year</div>
                    <input
                      type="number"
                      min={yearBounds[0]}
                      max={maxYear}
                      value={yearBounds[1]}
                      onChange={(e) => setYearBounds([yearBounds[0], Math.max(Number(e.target.value) || maxYear, yearBounds[0])])}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-500">Author</div>
                    <select
                      value={selectedAuthor}
                      onChange={(e) => setSelectedAuthor(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    >
                      {authorOptions.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {fieldOptions.slice(0, 12).map((field) => (
                  <Chip key={field} active={field === selectedField} onClick={() => setSelectedField(field)}>
                    {field}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total papers" value={formatNumber(derived.totalPapers)} hint="Filtered publications" accent />
              <MetricCard label="h-index" value={formatNumber(derived.h)} hint="From filtered citation counts" />
              <MetricCard label="Total citations" value={formatShort(derived.totalCitations)} hint={`Avg. ${derived.avgCitations.toFixed(1)} per paper`} />
              <MetricCard label="Top institution count" value={formatNumber(TARGET_INSTITUTIONS.length)} hint="Affiliation scope" />
            </div>

            <SectionCard
              title="Publication and citation time series"
              icon={BarChart3}
              subtitle="The most important view is placed first and left-aligned. Click a year to use it as a focus point."
              right={<div className="text-xs text-slate-500">D3.js rendered SVG</div>}
            >
              <YearTimelineChart data={timeSeriesData} selectedYear={selectedYear} onYearSelect={setSelectedYear} />
            </SectionCard>
          </div>

          <div className="grid gap-4">
            <SectionCard
              title="Publication distribution"
              icon={BarChart3}
              subtitle="Citation-per-paper histogram; useful for spotting long-tail impact."
              right={<div className="text-xs text-slate-500">Hover bars for counts</div>}
            >
              <CitationHistogram
                data={derived.bins}
                onSelectBin={(label) => {
                  const [start, end] = label.split("–").map((x) => Number(x));
                  const paper = [...visiblePapers].find((d) => d.citations >= start && d.citations <= end);
                  if (paper) setSelectedPaperId(paper.id);
                }}
              />
            </SectionCard>

            <SectionCard
              title="Top papers"
              icon={Search}
              subtitle="Selecting a paper updates the altmetrics panel and makes the dashboard feel connected."
            >
              <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
                {derived.topPapers.map((paper) => (
                  <button
                    key={paper.id}
                    onClick={() => setSelectedPaperId(paper.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      paper.id === selectedPaperId ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-medium">{paper.title}</div>
                        <div className={`mt-1 text-xs ${paper.id === selectedPaperId ? "text-slate-300" : "text-slate-500"}`}>
                          {paper.journal} · {paper.year} · {paper.authors.slice(0, 3).join(", ")}
                        </div>
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paper.id === selectedPaperId ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"}`}>
                        {formatNumber(paper.citations)} cit.
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
          <button onClick={() => setTab("overview")} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "overview" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            Overview
          </button>
          <button onClick={() => setTab("journal")} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "journal" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            Journals & altmetrics
          </button>
          <button onClick={() => setTab("network")} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === "network" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            Collaboration map
          </button>
        </div>

        {tab === "overview" ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Citation distribution"
              icon={BarChart3}
              subtitle="Interact with the bars to probe the long tail of citations per paper."
              right={<div className="text-xs text-slate-500">Click a bar to choose a paper in that band</div>}
            >
              <CitationHistogram
                data={derived.bins}
                onSelectBin={(label) => {
                  const [start, end] = label.split("–").map((x) => Number(x));
                  const paper = [...visiblePapers].sort((a, b) => b.citations - a.citations).find((d) => d.citations >= start && d.citations <= end);
                  if (paper) setSelectedPaperId(paper.id);
                  setTab("journal");
                }}
              />
            </SectionCard>

            <div className="grid gap-4">
              <SectionCard title="Key indicators" icon={Users} subtitle="Concise, high-value summary for dashboards and reports.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Papers" value={formatNumber(derived.totalPapers)} />
                  <MetricCard label="h-index" value={formatNumber(derived.h)} />
                  <MetricCard label="Citations" value={formatShort(derived.totalCitations)} />
                  <MetricCard label="Avg / paper" value={derived.avgCitations.toFixed(1)} />
                </div>
              </SectionCard>

              <SectionCard title="Research field filter" icon={Filter} subtitle="Use the chips above, or refine by author and year.">
                <div className="space-y-2 text-sm text-slate-600">
                  <div>Selected author: <span className="font-medium text-slate-900">{selectedAuthor}</span></div>
                  <div>Selected field: <span className="font-medium text-slate-900">{selectedField}</span></div>
                  <div>Selected year window: <span className="font-medium text-slate-900">{yearBounds[0]}–{yearBounds[1]}</span></div>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}

        {tab === "journal" ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard title="Journal breakdown" icon={Newspaper} subtitle="Counts, citations, and a journal impact factor enrichment column.">
              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Journal</th>
                      <th className="px-4 py-3">Papers</th>
                      <th className="px-4 py-3">Citations</th>
                      <th className="px-4 py-3">Avg.</th>
                      <th className="px-4 py-3">Impact factor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {journalDisplayRows.map((row) => (
                      <tr
                        key={row.label}
                        className={`cursor-pointer hover:bg-slate-50 ${selectedPaper?.journal === row.label ? "bg-slate-50" : ""}`}
                        onClick={() => {
                          const hit = visiblePapers.find((d) => d.journal === row.label);
                          if (hit) setSelectedPaperId(hit.id);
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="line-clamp-1">{row.label}</span>
                            {selectedPaper?.journal === row.label ? <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">selected</span> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">{formatNumber(row.papers)}</td>
                        <td className="px-4 py-3">{formatNumber(row.citations)}</td>
                        <td className="px-4 py-3">{row.avgCitations.toFixed(1)}</td>
                        <td className="px-4 py-3">{row.ifText}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Altmetrics panel" icon={Newspaper} subtitle="Crossref Event Data exposes online mentions from social and news sources.">
              {selectedPaper ? (
                <div className="space-y-4">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <div className="text-sm font-semibold text-slate-900">{selectedPaper.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {selectedPaper.journal} · {selectedPaper.year} · {selectedPaper.authors.slice(0, 4).join(", ")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">DOI: {selectedPaper.doi || "n/a"}</span>
                      <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">Citations: {formatNumber(selectedPaper.citations)}</span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard label="Social mentions" value={formatNumber(sourceCount.social)} hint="Twitter, Reddit, StackExchange, blogs, web" />
                    <MetricCard label="News mentions" value={formatNumber(sourceCount.news)} hint="Newsfeed sources" />
                    <MetricCard label="Other events" value={formatNumber(sourceCount.other)} hint="Additional Event Data sources" />
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event source breakdown</div>
                    <div className="mt-3 space-y-3">
                      {Object.entries(altmetrics.bySource || {})
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 8)
                        .map(([source, count]) => (
                          <div key={source}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700">{source}</span>
                              <span className="text-slate-500">{formatNumber(count)}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(8, Math.min(100, (count / Math.max(1, altmetrics.total)) * 100))}%` }} />
                            </div>
                          </div>
                        ))}
                      {!Object.keys(altmetrics.bySource || {}).length ? (
                        <div className="text-sm text-slate-500">No Event Data records were returned for this DOI.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Select a paper to view attention and mention counts.</div>
              )}
            </SectionCard>
          </div>
        ) : null}

        {tab === "network" ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.7fr]">
            <SectionCard title="Co-authorship network" icon={Network} subtitle="Node size reflects collaboration degree. Click a node to filter by author.">
              <NetworkGraph
                graph={derived.graph}
                onSelectAuthor={(author) => {
                  setSelectedAuthor(author);
                  setTab("overview");
                }}
              />
            </SectionCard>
            <SectionCard title="Collaboration notes" icon={Users} subtitle="Use this side panel to keep the screen uncluttered while preserving context.">
              <div className="space-y-4 text-sm text-slate-600">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Focused author</div>
                  <div className="mt-1 text-base font-medium text-slate-900">{selectedAuthor}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collaboration intensity</div>
                  <div className="mt-1 text-slate-900">{formatNumber(derived.graph.links.length)} links across {formatNumber(derived.graph.nodes.length)} visible authors</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tip</div>
                  <div className="mt-1">Click a node to narrow the entire dashboard to that collaborator. The publication, journal, and altmetrics views all update together.</div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top authors</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {derived.authors.slice(0, 16).map((a) => (
                      <button key={a.name} onClick={() => setSelectedAuthor(a.name)} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              Data sources: OpenAlex for works, authors, institutions, and citation counts; Crossref Event Data for social/news mentions; journal impact factors can be sourced from a maintained enrichment table.
            </div>
            <div className="inline-flex items-center gap-2">
              <ExternalLink className="h-3.5 w-3.5" /> Designed for clean, top-left-first scientific reporting.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
