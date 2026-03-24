#!/usr/bin/env python3
"""
generate_data.py — Synthetic Scientometric Data Generator

Generates realistic longitudinal publication data for fictional researchers.
The data model is designed to align with the DORA declaration by emphasizing
article-level metrics, diverse research outputs, and qualitative impact
indicators rather than journal-level metrics like Impact Factor.

Output: data/researchers.json

Usage:
    python generate_data.py
"""

import json
import random
import os
from datetime import datetime

random.seed(42)  # Reproducibility

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TOPICS_POOL = {
    "computational_biology": [
        "protein folding", "genomics", "systems biology",
        "single-cell analysis", "phylogenetics", "structural biology",
        "metagenomics", "transcriptomics", "drug discovery",
    ],
    "machine_learning": [
        "deep learning", "NLP", "computer vision", "reinforcement learning",
        "graph neural networks", "generative models", "fairness in AI",
        "federated learning", "transformers",
    ],
    "ecology": [
        "biodiversity", "climate adaptation", "conservation genetics",
        "ecosystem services", "population dynamics", "community ecology",
        "landscape ecology", "macroecology", "pollination networks",
    ],
    "social_science": [
        "science policy", "research ethics", "bibliometrics",
        "open science", "peer review", "science communication",
        "higher education", "innovation studies", "knowledge production",
    ],
}

# Output types weighted to reflect real-world distribution.
# DORA emphasizes valuing ALL output types, not just journal articles.
OUTPUT_TYPES = ["article", "article", "article", "article",
                "preprint", "dataset", "software", "review", "book_chapter"]

JOURNALS_BY_FIELD = {
    "computational_biology": [
        "PLOS Computational Biology", "Bioinformatics", "BMC Genomics",
        "Nucleic Acids Research", "Genome Biology", "Nature Methods",
        "Cell Systems", "GigaScience",
    ],
    "machine_learning": [
        "JMLR", "NeurIPS Proceedings", "ICML Proceedings", "AAAI Proceedings",
        "IEEE TPAMI", "Pattern Recognition", "Machine Learning",
        "Artificial Intelligence",
    ],
    "ecology": [
        "Ecology Letters", "Journal of Ecology", "Ecological Applications",
        "Conservation Biology", "Oikos", "Functional Ecology",
        "Methods in Ecology and Evolution", "Ecography",
    ],
    "social_science": [
        "Scientometrics", "Research Policy", "Science and Public Policy",
        "PLOS ONE", "Quantitative Science Studies", "Journal of Informetrics",
        "Research Evaluation", "Learned Publishing",
    ],
}

COAUTHOR_POOL = [
    "Alex Rivera", "Priya Sharma", "Wei Zhang", "Sofia Rossi",
    "James Okafor", "Yuki Tanaka", "Fatima Al-Hassan", "Lars Eriksson",
    "Chen Wei-Lin", "Ana Morales", "David Kim", "Olga Petrov",
    "Rashid Khan", "Emma Johansson", "Carlos Mendez", "Nadia Osei",
    "Tomoko Hayashi", "Ibrahim Diallo", "Lena Muller", "Raj Patel",
    "Grace Adeyemi", "Marco Bianchi", "Hannah Lee", "Samuel Okoro",
    "Ines Ferreira", "Dmitri Volkov", "Amara Sy", "Kenji Nakamura",
]


# ---------------------------------------------------------------------------
# Researcher profiles
# ---------------------------------------------------------------------------

RESEARCHERS = [
    {
        "name": "Maria Chen",
        "affiliation": "Institute for Computational Biology, ETH Zurich",
        "orcid": "0000-0002-1234-5678",
        "primary_field": "computational_biology",
        "secondary_field": "machine_learning",
        "career_start": 2010,
        "productivity_mean": 5,   # papers/year average
        "citation_power": 1.2,    # multiplier on expected citations
        "collab_breadth": 0.7,    # probability of multi-author work
        "oa_tendency": 0.7,       # probability of open access
    },
    {
        "name": "James Okafor",
        "affiliation": "Department of Ecology, University of Cape Town",
        "orcid": "0000-0003-8765-4321",
        "primary_field": "ecology",
        "secondary_field": "social_science",
        "career_start": 2008,
        "productivity_mean": 4,
        "citation_power": 1.0,
        "collab_breadth": 0.6,
        "oa_tendency": 0.5,
    },
    {
        "name": "Priya Sharma",
        "affiliation": "AI Research Lab, Indian Institute of Science",
        "orcid": "0000-0001-2345-6789",
        "primary_field": "machine_learning",
        "secondary_field": "computational_biology",
        "career_start": 2014,
        "productivity_mean": 7,
        "citation_power": 1.5,
        "collab_breadth": 0.8,
        "oa_tendency": 0.8,
    },
    {
        "name": "Lars Eriksson",
        "affiliation": "Department of Science Studies, Lund University",
        "orcid": "0000-0002-9876-5432",
        "primary_field": "social_science",
        "secondary_field": "ecology",
        "career_start": 2005,
        "productivity_mean": 3,
        "citation_power": 0.8,
        "collab_breadth": 0.4,
        "oa_tendency": 0.6,
    },
    {
        "name": "Sofia Rossi",
        "affiliation": "Center for Open Science, University of Bologna",
        "orcid": "0000-0003-1111-2222",
        "primary_field": "social_science",
        "secondary_field": "machine_learning",
        "career_start": 2012,
        "productivity_mean": 5,
        "citation_power": 1.1,
        "collab_breadth": 0.65,
        "oa_tendency": 0.9,
    },
]


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def pick_topics(primary_field, secondary_field, n=2):
    """Select research topics, weighted toward primary field."""
    pool = TOPICS_POOL[primary_field] * 3 + TOPICS_POOL[secondary_field]
    return random.sample(pool, min(n, len(pool)))


def pick_coauthors(researcher_name, breadth, max_n=6):
    """Select a set of co-authors, excluding the researcher themselves."""
    if random.random() > breadth:
        return []  # Solo paper
    available = [c for c in COAUTHOR_POOL if c != researcher_name]
    n = random.randint(1, max_n)
    return random.sample(available, min(n, len(available)))


def generate_citations(year, current_year, citation_power, output_type):
    """
    Generate a realistic citation count.
    Older papers accumulate more citations. Reviews tend to get more.
    Citation distributions are highly skewed (log-normal), as DORA notes.
    """
    age = current_year - year
    if age <= 0:
        return 0

    # Base expectation varies by output type
    base = {"article": 8, "review": 15, "preprint": 3,
            "dataset": 2, "software": 4, "book_chapter": 5}
    mu = base.get(output_type, 5) * citation_power

    # Log-normal distribution captures the skewed nature of citations
    raw = random.lognormvariate(0, 1.0) * mu * (age ** 0.6)
    return max(0, int(raw))


def generate_altmetrics(citations, output_type):
    """
    Generate alternative attention metrics.
    DORA recommends considering a broad range of impact measures.
    """
    base = max(1, citations * 0.3)
    return {
        "twitter_mentions": max(0, int(random.expovariate(1 / (base * 2)))),
        "news_mentions": max(0, int(random.expovariate(1 / max(1, base * 0.1)))),
        "blog_mentions": max(0, int(random.expovariate(1 / max(1, base * 0.15)))),
        "policy_citations": max(0, int(random.expovariate(1 / max(1, base * 0.05)))),
        "wikipedia_citations": 1 if random.random() < 0.05 * (citations / 50) else 0,
        "downloads": max(0, int(random.lognormvariate(3, 1.5) + citations * 3)),
    }


def compute_field_normalized_citation(citations, year, current_year, field):
    """
    Compute field-normalized citation impact (FWCI-like).
    DORA rec #14: account for variation in subject areas.
    A value of 1.0 means average for the field; >1.0 means above average.
    """
    age = max(1, current_year - year)
    # Different fields have different citation norms
    field_baseline = {
        "computational_biology": 12, "machine_learning": 15,
        "ecology": 8, "social_science": 6,
    }
    expected = field_baseline.get(field, 10) * (age ** 0.5)
    if expected == 0:
        return 0
    return round(citations / expected, 2)


# ---------------------------------------------------------------------------
# Main generation
# ---------------------------------------------------------------------------

def generate_researcher_data(profile, current_year=2025):
    """Generate the full publication record for one researcher."""
    publications = []
    all_coauthors = set()

    for year in range(profile["career_start"], current_year + 1):
        # Number of outputs this year (Poisson-like)
        n_outputs = max(0, int(random.gauss(profile["productivity_mean"],
                                            profile["productivity_mean"] * 0.4)))
        for _ in range(n_outputs):
            output_type = random.choice(OUTPUT_TYPES)
            topics = pick_topics(profile["primary_field"],
                                 profile["secondary_field"])
            coauthors = pick_coauthors(profile["name"],
                                       profile["collab_breadth"])
            all_coauthors.update(coauthors)

            citations = generate_citations(year, current_year,
                                           profile["citation_power"],
                                           output_type)
            fwci = compute_field_normalized_citation(
                citations, year, current_year, profile["primary_field"])

            # Journal/venue — only for articles and reviews
            venue = None
            if output_type in ("article", "review"):
                field_journals = JOURNALS_BY_FIELD[profile["primary_field"]]
                venue = random.choice(field_journals)
            elif output_type == "preprint":
                venue = random.choice(["bioRxiv", "arXiv", "SSRN", "EarthArXiv"])
            elif output_type == "dataset":
                venue = random.choice(["Zenodo", "Dryad", "Figshare", "Dataverse"])
            elif output_type == "software":
                venue = random.choice(["GitHub/Zenodo", "PyPI", "CRAN", "Bioconductor"])
            elif output_type == "book_chapter":
                venue = random.choice(["Springer", "Elsevier", "Cambridge UP", "Oxford UP"])

            is_oa = random.random() < profile["oa_tendency"]

            pub = {
                "year": year,
                "type": output_type,
                "topics": topics,
                "coauthors": coauthors,
                "venue": venue,
                "open_access": is_oa,
                "citations": citations,
                "field_weighted_citation_impact": fwci,
                "altmetrics": generate_altmetrics(citations, output_type),
            }
            publications.append(pub)

    # Sort by year
    publications.sort(key=lambda p: p["year"])

    return {
        "name": profile["name"],
        "affiliation": profile["affiliation"],
        "orcid": profile["orcid"],
        "primary_field": profile["primary_field"],
        "secondary_field": profile["secondary_field"],
        "career_start": profile["career_start"],
        "unique_collaborators": sorted(list(all_coauthors)),
        "publications": publications,
    }


def main():
    current_year = 2025
    data = {}
    for profile in RESEARCHERS:
        researcher = generate_researcher_data(profile, current_year)
        data[researcher["name"]] = researcher
        print(f"Generated {len(researcher['publications'])} outputs "
              f"for {researcher['name']}")

    output_path = os.path.join(os.path.dirname(__file__), "data", "researchers.json")
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\nData written to {output_path}")
    print(f"Total researchers: {len(data)}")
    total_pubs = sum(len(r["publications"]) for r in data.values())
    print(f"Total outputs: {total_pubs}")


if __name__ == "__main__":
    main()
