#!/usr/bin/env node
// ds-lint.mjs — Design-system enforcement linter (zinc redesign)
// Scans app/apps/**/*.tsx line by line.
// Supports ds-lint-disable / ds-lint-enable fence comments (// or {/* */} forms).

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const APPS_DIR = join(ROOT, "app", "apps");

/** @type {{ pattern: string; message: string }[]} */
const BANNED = [
  {
    pattern: "shadow-[0_-8px_24px_rgba(12,12,16,0.08)]",
    message: "ControlPanel を使う",
  },
  {
    pattern: "text-[18px] font-medium text-wb-900",
    message: "ControlPanel の title に置き換える",
  },
  {
    pattern: "text-[15px] font-medium text-wb-900",
    message: "SectionTitle / PanelSection title を使う",
  },
  {
    pattern: "pb-[88px]",
    message: "ControlPanel(スクロール領域内蔵)を使う",
  },
  {
    pattern: "bg-gradient-to-t from-white to-transparent",
    message: "ControlPanel の footer スロットを使う",
  },
  {
    pattern: "bottom-[calc(100%",
    message: "OutputMenu を使う",
  },
  {
    pattern: 'addEventListener("pointerdown"',
    message: "OutputMenu(外側クローズ内蔵)を使う",
  },
  {
    pattern: "addEventListener('pointerdown'",
    message: "OutputMenu(外側クローズ内蔵)を使う",
  },
  {
    pattern: "h-10 px-4 rounded-[10px] bg-wb-900",
    message: "FlatButton(solid)を使う",
  },
  {
    pattern: "h-10 px-4 rounded-[10px] bg-wb-0 border border-wb-200",
    message: "FlatButton(outline)を使う",
  },
  {
    pattern: "font-mono text-[12px] leading-relaxed",
    message: "CodeField を使う",
  },
  {
    pattern: "pl-3 border-l-2",
    message: "NestedGroup を使う",
  },
  {
    pattern: "gap-[7px]",
    message: "パネル内コントロール間隔は gap-2 に統一（PanelSection / NestedGroup のデフォルト）",
  },
  {
    pattern: '<input type="color"',
    message: "ColorSwatch / ColorRow を使う",
  },
  {
    pattern: "size-7 shrink-0 items-center justify-center rounded-full",
    message: "CircleButton を使う",
  },
  {
    pattern: "rounded-[12px] border border-[rgba(12,12,16,0.05)] bg-wb-50",
    message: "ControlRow / ColorRow を使う",
  },
];

/** Recursively collect .tsx files under a directory */
function collectTsx(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...collectTsx(full));
    } else if (entry.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

/** Lint a single file; returns array of { lineNo, pattern, message } */
function lintFile(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const violations = [];
  let disabled = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("ds-lint-disable")) {
      disabled = true;
      continue;
    }
    if (line.includes("ds-lint-enable")) {
      disabled = false;
      continue;
    }
    if (disabled) continue;

    for (const { pattern, message } of BANNED) {
      if (line.includes(pattern)) {
        violations.push({ lineNo: i + 1, pattern, message });
      }
    }
  }

  return violations;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const files = collectTsx(APPS_DIR);
let totalViolations = 0;

for (const file of files) {
  const violations = lintFile(file);
  const rel = relative(ROOT, file);
  for (const { lineNo, pattern, message } of violations) {
    console.log(`${rel}:${lineNo}  ${pattern} → ${message}`);
    totalViolations++;
  }
}

if (totalViolations === 0) {
  console.log(`ds-lint: OK (${files.length} files scanned)`);
  process.exit(0);
} else {
  console.log(`\nds-lint: ${totalViolations} violation(s) in ${files.length} files scanned`);
  process.exit(1);
}
