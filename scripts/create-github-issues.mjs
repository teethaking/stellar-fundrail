#!/usr/bin/env node
/**
 * Files the FundRail contributor backlog as GitHub issues.
 *
 * The issues are defined as markdown files in `.github/ISSUES/` with YAML
 * frontmatter (title, labels, area, difficulty, size). This script parses
 * them and creates each one with the GitHub CLI, so the backlog is reviewable
 * in-repo and can be re-filed at any time.
 *
 * Requirements:
 *   - GitHub CLI:        https://cli.github.com
 *   - Authenticated:     gh auth login
 *   - A repo configured: gh repo set-default (or run from a clone)
 *
 * Usage:
 *   bun run scripts/create-github-issues.mjs             # create all issues
 *   bun run scripts/create-github-issues.mjs --dry-run   # print what would be created
 *   bun run scripts/create-github-issues.mjs --area contracts  # only one area
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ISSUES_DIR = join(process.cwd(), ".github", "ISSUES");
const DRY_RUN = process.argv.includes("--dry-run");
const AREA_FLAG = process.argv.indexOf("--area");
const AREA_FILTER = AREA_FLAG !== -1 ? process.argv[AREA_FLAG + 1] : undefined;

/** Minimal YAML frontmatter parser for title/labels/area/difficulty/size. */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Missing frontmatter block");
  const fields = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    fields[key] = value;
  }
  fields.labels = fields.labels
    ? fields.labels
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((l) => l.trim().replace(/^"(.*)"$/, "$1"))
        .filter(Boolean)
    : [];
  fields.area = fields.area || "other";
  return { ...fields, body: match[2].trim() };
}

function gh(args, opts = {}) {
  return spawnSync("gh", args, { stdio: "inherit", ...opts });
}

function listExistingTitles() {
  const res = spawnSync(
    "gh",
    ["issue", "list", "--state", "all", "--limit", "500", "--json", "title"],
    { encoding: "utf-8" },
  );
  if (res.status !== 0) {
    console.error("⚠  Could not list existing issues — continuing without dedup.");
    return new Set();
  }
  return new Set(JSON.parse(res.stdout).map((i) => i.title));
}

function main() {
  const files = readdirSync(ISSUES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();

  if (files.length === 0) {
    console.error(`No issue files found in ${ISSUES_DIR}`);
    process.exit(1);
  }

  let issues = files.map((f) => {
    const parsed = parseFrontmatter(readFileSync(join(ISSUES_DIR, f), "utf-8"));
    if (!parsed.title) throw new Error(`${f}: missing title`);
    return { file: f, ...parsed };
  });

  if (AREA_FILTER) {
    issues = issues.filter((i) => i.area === AREA_FILTER);
    console.log(`Filtered to area "${AREA_FILTER}": ${issues.length} issues\n`);
    if (issues.length === 0) process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`Dry run — would create ${issues.length} issues:\n`);
    for (const i of issues) {
      console.log(
        `- [${i.area}] ${i.title}  (${i.difficulty}, ${i.size})  labels: ${i.labels.join(", ") || "none"}`,
      );
    }
    return;
  }

  // 1. Create labels (best-effort; --force reuses existing ones).
  for (const label of [...new Set(issues.flatMap((i) => i.labels))]) {
    console.log(`label: ${label}`);
    gh(["label", "create", label, "--force"]);
  }

  // 2. Create issues, skipping any whose title already exists.
  const existing = listExistingTitles();
  let created = 0;
  const tmp = "/tmp/fundrail-issue.md";
  for (const issue of issues) {
    if (existing.has(issue.title)) {
      console.log(`skip (already exists): ${issue.title}`);
      continue;
    }
    writeFileSync(
      tmp,
      `${issue.body}\n\n---\n\n_Area: ${issue.area} · Difficulty: ${issue.difficulty} · Size: ${issue.size}_\n`,
    );
    const args = ["issue", "create", "--title", issue.title, "--body-file", tmp];
    for (const label of issue.labels) args.push("--label", label);
    if (gh(args).status === 0) created++;
  }
  console.log(`\nDone: created ${created} issues (of ${issues.length} processed).`);
}

main();
