#!/usr/bin/env python3
"""
Plagiarism detection across Arquisoft yovi_* repositories.
Uses Jaccard similarity on 5-gram shingles.
"""

import os
import re
import sys
import itertools
from collections import defaultdict
from pathlib import Path

BASE_DIR = Path(__file__).parent / "plagiarism"
REPORT_PATH = Path(__file__).parent / "plagiarism_report.txt"

REPOS = [
    "yovi_en1a", "yovi_en1b", "yovi_en1c",
    "yovi_en2a", "yovi_en2b", "yovi_en2c",
    "yovi_en3a", "yovi_en3b", "yovi_en3c",
    "yovi_es1a", "yovi_es1b", "yovi_es1c",
    "yovi_es2a", "yovi_es2b", "yovi_es2c",
    "yovi_es3a", "yovi_es3b", "yovi_es3c",
    "yovi_es4a", "yovi_es4b", "yovi_es4c", "yovi_es4d",
    "yovi_es5a", "yovi_es5b", "yovi_es5c",
]

EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".rs", ".py"}
EXCLUDE_DIRS = {"node_modules", "target", "dist", "build", "__pycache__", ".git", ".d.ts"}
MAX_TOKENS = 10000
SHINGLE_SIZE = 5
SIMILARITY_THRESHOLD = 0.8

REPO_NAME_PATTERN = re.compile(r'yovi_[a-z0-9]+', re.IGNORECASE)
COMMENT_PATTERN_JS = re.compile(r'//[^\n]*|/\*.*?\*/', re.DOTALL)
COMMENT_PATTERN_PY = re.compile(r'#[^\n]*|""".*?"""|\'\'\'.*?\'\'\'', re.DOTALL)
COMMENT_PATTERN_RS = re.compile(r'//[^\n]*|/\*.*?\*/', re.DOTALL)
WHITESPACE_PATTERN = re.compile(r'\s+')


def normalize(content: str, ext: str) -> str:
    """Normalize source code: remove comments, extra whitespace, repo names."""
    if ext in (".ts", ".tsx", ".js", ".jsx"):
        content = COMMENT_PATTERN_JS.sub(" ", content)
    elif ext == ".py":
        content = COMMENT_PATTERN_PY.sub(" ", content)
    elif ext == ".rs":
        content = COMMENT_PATTERN_RS.sub(" ", content)
    content = REPO_NAME_PATTERN.sub("REPO", content)
    content = WHITESPACE_PATTERN.sub(" ", content).strip().lower()
    return content


def tokenize(content: str) -> list:
    tokens = re.findall(r'[a-zA-Z0-9_$]+|[{}()\[\];,.<>=!&|+\-*/]', content)
    return tokens[:MAX_TOKENS]


def shingles(tokens: list, k: int = SHINGLE_SIZE) -> set:
    if len(tokens) < k:
        return set(tuple(tokens))
    return {tuple(tokens[i:i+k]) for i in range(len(tokens) - k + 1)}


def jaccard(set_a: set, set_b: set) -> float:
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    inter = len(set_a & set_b)
    union = len(set_a | set_b)
    return inter / union


def get_source_files(repo_path: Path) -> dict:
    """Returns {relative_path: shingle_set} for all source files in repo."""
    files = {}
    for root, dirs, filenames in os.walk(repo_path):
        # Prune excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for fname in filenames:
            # Skip .d.ts files
            if fname.endswith(".d.ts"):
                continue
            ext = Path(fname).suffix
            if ext not in EXTENSIONS:
                continue
            fpath = Path(root) / fname
            rel_path = fpath.relative_to(repo_path)
            # Skip paths containing excluded dir names
            parts = rel_path.parts
            if any(p in EXCLUDE_DIRS for p in parts):
                continue
            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
                norm = normalize(content, ext)
                tokens = tokenize(norm)
                sh = shingles(tokens)
                files[str(rel_path)] = sh
            except Exception as e:
                pass
    return files


def progress(msg):
    print(f"[PROGRESS] {msg}", flush=True)


def main():
    lines = []

    def log(msg=""):
        print(msg)
        lines.append(msg)

    # ------------------------------------------------------------------ #
    # Step 1: Load all repos
    # ------------------------------------------------------------------ #
    progress("Loading source files from all repos...")
    repo_files = {}
    for repo in REPOS:
        rpath = BASE_DIR / repo
        if not rpath.exists():
            progress(f"  MISSING: {repo}")
            continue
        files = get_source_files(rpath)
        repo_files[repo] = files
        progress(f"  {repo}: {len(files)} source files")

    present_repos = list(repo_files.keys())
    n_repos = len(present_repos)
    progress(f"Loaded {n_repos} repos total.")

    # ------------------------------------------------------------------ #
    # Step 2: Same-path file comparison
    # ------------------------------------------------------------------ #
    progress("Computing same-path file similarities...")

    # Map: relative_path -> list of (repo, shingle_set)
    path_to_repos: dict = defaultdict(list)
    for repo, files in repo_files.items():
        for rel_path, sh in files.items():
            path_to_repos[rel_path].append((repo, sh))

    # Suspicious pairs: (repo_a, repo_b, rel_path, similarity)
    suspicious_same_path = []
    for rel_path, entries in path_to_repos.items():
        if len(entries) < 2:
            continue
        for (ra, sha), (rb, shb) in itertools.combinations(entries, 2):
            sim = jaccard(sha, shb)
            if sim >= SIMILARITY_THRESHOLD:
                suspicious_same_path.append((ra, rb, rel_path, sim))

    progress(f"Found {len(suspicious_same_path)} suspicious same-path file pairs.")

    # ------------------------------------------------------------------ #
    # Step 3: Repo-level similarity matrix
    # ------------------------------------------------------------------ #
    progress("Computing repo-level similarity scores...")

    # For each pair of repos: count same-path files that are similar
    pair_similar_count: dict = defaultdict(int)
    pair_total_count: dict = defaultdict(int)

    for rel_path, entries in path_to_repos.items():
        if len(entries) < 2:
            continue
        for (ra, sha), (rb, shb) in itertools.combinations(entries, 2):
            key = (min(ra, rb), max(ra, rb))
            pair_total_count[key] += 1
            sim = jaccard(sha, shb)
            if sim >= SIMILARITY_THRESHOLD:
                pair_similar_count[key] += 1

    # Also compute a "bulk shingle similarity" per repo pair using all files
    progress("Computing bulk repo-level shingle similarity...")
    repo_combined_shingles = {}
    for repo, files in repo_files.items():
        combined = set()
        for sh in files.values():
            combined.update(sh)
        repo_combined_shingles[repo] = combined

    repo_pair_bulk_sim = {}
    pairs = list(itertools.combinations(present_repos, 2))
    for ra, rb in pairs:
        sim = jaccard(repo_combined_shingles[ra], repo_combined_shingles[rb])
        repo_pair_bulk_sim[(ra, rb)] = sim

    # ------------------------------------------------------------------ #
    # Step 4: Most copied files
    # ------------------------------------------------------------------ #
    progress("Finding most-copied files...")

    # For each rel_path, count how many repos have it with high mutual similarity
    file_spread: dict = {}
    for rel_path, entries in path_to_repos.items():
        if len(entries) < 3:
            continue
        # count pairs above threshold
        high_sim_pairs = 0
        total_pairs = 0
        for (ra, sha), (rb, shb) in itertools.combinations(entries, 2):
            total_pairs += 1
            if jaccard(sha, shb) >= SIMILARITY_THRESHOLD:
                high_sim_pairs += 1
        if total_pairs > 0 and high_sim_pairs / total_pairs >= 0.5:
            file_spread[rel_path] = {
                "repos": len(entries),
                "high_sim_pairs": high_sim_pairs,
                "total_pairs": total_pairs,
                "ratio": high_sim_pairs / total_pairs,
            }

    most_copied = sorted(file_spread.items(), key=lambda x: (-x[1]["repos"], -x[1]["ratio"]))

    # ------------------------------------------------------------------ #
    # Step 5: Ranking suspicious repo pairs
    # ------------------------------------------------------------------ #
    repo_pair_score = {}
    for key in pairs:
        ra, rb = key
        file_sim_ratio = 0.0
        if pair_total_count[key] > 0:
            file_sim_ratio = pair_similar_count[key] / pair_total_count[key]
        bulk_sim = repo_pair_bulk_sim.get(key, 0.0)
        # Combined score: weighted average
        score = 0.6 * file_sim_ratio + 0.4 * bulk_sim
        repo_pair_score[key] = {
            "file_sim_ratio": file_sim_ratio,
            "bulk_sim": bulk_sim,
            "score": score,
            "similar_files": pair_similar_count[key],
            "common_files": pair_total_count[key],
        }

    ranked_pairs = sorted(repo_pair_score.items(), key=lambda x: -x[1]["score"])

    # ------------------------------------------------------------------ #
    # REPORT
    # ------------------------------------------------------------------ #
    log("=" * 80)
    log("          PLAGIARISM DETECTION REPORT — Arquisoft yovi_* Repos")
    log("=" * 80)
    log()
    log(f"Repos analysed : {n_repos}")
    log(f"Similarity threshold: {SIMILARITY_THRESHOLD}")
    log(f"Shingle size: {SHINGLE_SIZE} tokens")
    log(f"Max tokens per file: {MAX_TOKENS}")
    log()

    # ------------------------------------------------------------------ #
    # Section 1: Top suspicious repo pairs
    # ------------------------------------------------------------------ #
    log("=" * 80)
    log("  SECTION 1: TOP SUSPICIOUS REPO PAIRS (score = 0.6*file_ratio + 0.4*bulk)")
    log("=" * 80)
    log(f"{'Rank':<5} {'Repo A':<14} {'Repo B':<14} {'Score':>7} {'File%':>7} {'Bulk%':>7} {'SimFiles':>9} {'CommonFiles':>12}")
    log("-" * 80)
    for rank, (key, v) in enumerate(ranked_pairs[:50], 1):
        ra, rb = key
        if v["score"] < 0.05:
            break
        log(f"{rank:<5} {ra:<14} {rb:<14} {v['score']:>7.3f} {v['file_sim_ratio']:>7.3f} {v['bulk_sim']:>7.3f} {v['similar_files']:>9} {v['common_files']:>12}")
    log()

    # ------------------------------------------------------------------ #
    # Section 2: Heat map (bulk similarity)
    # ------------------------------------------------------------------ #
    log("=" * 80)
    log("  SECTION 2: BULK SIMILARITY HEAT MAP (Jaccard on combined shingles)")
    log("  (rows = repo A, cols = repo B, values = Jaccard * 100)")
    log("=" * 80)
    # Header row
    short = [r.replace("yovi_", "") for r in present_repos]
    header = "         " + "".join(f"{s:>7}" for s in short)
    log(header)
    log("-" * len(header))
    for i, ra in enumerate(present_repos):
        row = f"{short[i]:<8} "
        for j, rb in enumerate(present_repos):
            if i == j:
                row += "  100  "
            elif i < j:
                sim = repo_pair_bulk_sim.get((ra, rb), 0)
                row += f"{sim*100:>6.1f} "
            else:
                sim = repo_pair_bulk_sim.get((rb, ra), 0)
                row += f"{sim*100:>6.1f} "
        log(row)
    log()

    # ------------------------------------------------------------------ #
    # Section 3: Most copied files
    # ------------------------------------------------------------------ #
    log("=" * 80)
    log("  SECTION 3: MOST COPIED FILES")
    log("  (files present in ≥3 repos with ≥50% of pairs above threshold)")
    log("=" * 80)
    if most_copied:
        log(f"{'Repos':>6} {'SimPairs%':>10}  {'File Path'}")
        log("-" * 80)
        for rel_path, info in most_copied[:50]:
            log(f"{info['repos']:>6} {info['ratio']*100:>9.1f}%  {rel_path}")
    else:
        log("  No widely-copied files found above threshold.")
    log()

    # ------------------------------------------------------------------ #
    # Section 4: Detailed suspicious file pairs
    # ------------------------------------------------------------------ #
    log("=" * 80)
    log(f"  SECTION 4: SUSPICIOUS FILE PAIRS (similarity ≥ {SIMILARITY_THRESHOLD})")
    log("=" * 80)
    suspicious_sorted = sorted(suspicious_same_path, key=lambda x: -x[3])
    log(f"{'Sim':>6}  {'Repo A':<14} {'Repo B':<14}  {'File'}")
    log("-" * 80)
    for ra, rb, rel_path, sim in suspicious_sorted[:200]:
        log(f"{sim:>6.3f}  {ra:<14} {rb:<14}  {rel_path}")
    if len(suspicious_sorted) > 200:
        log(f"  ... and {len(suspicious_sorted) - 200} more pairs (truncated)")
    log()

    # ------------------------------------------------------------------ #
    # Section 5: Per-repo summary
    # ------------------------------------------------------------------ #
    log("=" * 80)
    log("  SECTION 5: PER-REPO SUMMARY")
    log("=" * 80)
    log(f"{'Repo':<14} {'Files':>7}  {'TopSimilarPair':<30} {'Score':>7}")
    log("-" * 70)
    for repo in present_repos:
        n_files = len(repo_files[repo])
        # find best matching repo
        best_score = 0.0
        best_partner = "-"
        for key, v in repo_pair_score.items():
            ra, rb = key
            if ra == repo or rb == repo:
                if v["score"] > best_score:
                    best_score = v["score"]
                    best_partner = rb if ra == repo else ra
        log(f"{repo:<14} {n_files:>7}  {best_partner:<30} {best_score:>7.3f}")
    log()

    log("=" * 80)
    log("  END OF REPORT")
    log("=" * 80)

    # Save
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    progress(f"Report saved to: {REPORT_PATH}")


if __name__ == "__main__":
    main()
