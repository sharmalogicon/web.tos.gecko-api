/**
 * Style-Catalog Violation Detector
 *
 * Scans every .tsx file in src/ for inline `style={{...}}` JSX attributes
 * whose key/value set matches a known Gecko design-system catalog signature.
 *
 * Output: STYLE-AUDIT.md at the repo root with file/line/column references
 * and the suggested catalog class for each match.
 *
 * This is the canonical enforcement layer that AI agents cannot replace:
 * deterministic, exhaustive, and portable across all Gecko apps.
 *
 * Usage:
 *   npx tsx scripts/style-catalog/detect.ts          # report-only
 *   npx tsx scripts/style-catalog/detect.ts --src=<path>  # scan a different folder
 *
 * Run from the repo root.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { SIGNATURES, type Signature, type PropMatcher } from './signatures';

/* ──────────────────────────────────────────────────────────────────────────
   Configuration
   ────────────────────────────────────────────────────────────────────────── */

const args = new Map(
  process.argv.slice(2).map(a => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=')];
  })
);

const REPO_ROOT = process.cwd();
const SRC_DIR = path.resolve(REPO_ROOT, args.get('src') || 'src');
const OUTPUT_PATH = path.resolve(REPO_ROOT, args.get('out') || 'STYLE-AUDIT.md');

/* ──────────────────────────────────────────────────────────────────────────
   Matcher: does an inline-style object match a signature?
   ────────────────────────────────────────────────────────────────────────── */

interface InlineStyle {
  filePath: string;
  line: number;       // 1-indexed
  column: number;     // 1-indexed
  props: Map<string, string | number>;  // normalised
  raw: string;        // original source slice
}

interface Match {
  inline: InlineStyle;
  signature: Signature;
  matchedKeys: string[];
}

function valueMatches(actual: string | number, matcher: PropMatcher): boolean {
  if (matcher === true) return true;
  if (Array.isArray(matcher)) {
    return matcher.some(m => normaliseValue(m) === normaliseValue(actual));
  }
  if (typeof matcher === 'object' && matcher !== null && 'in' in matcher) {
    return matcher.in.some(m => normaliseValue(m) === normaliseValue(actual));
  }
  return normaliseValue(matcher) === normaliseValue(actual);
}

function normaliseValue(v: string | number): string {
  if (typeof v === 'number') return String(v);
  // Strip 'px' suffix so 12 and '12px' compare equal
  const s = String(v).trim();
  if (/^\d+(\.\d+)?px$/.test(s)) return s.replace(/px$/, '');
  return s;
}

function tryMatch(inline: InlineStyle, sig: Signature): Match | null {
  const required = Object.keys(sig.props);
  const matched: string[] = [];

  for (const key of required) {
    const actual = inline.props.get(key);
    if (actual === undefined) continue;
    if (valueMatches(actual, sig.props[key])) {
      matched.push(key);
    }
  }

  const minMatch = sig.minMatch ?? required.length;
  if (matched.length < minMatch) return null;

  // If propsExact, the inline must NOT have any keys outside our required set.
  if (sig.propsExact) {
    for (const k of inline.props.keys()) {
      if (!required.includes(k)) return null;
    }
  }

  return { inline, signature: sig, matchedKeys: matched };
}

/* ──────────────────────────────────────────────────────────────────────────
   Walker: extract every JSX inline-style object from a source file
   ────────────────────────────────────────────────────────────────────────── */

function extractInlineStyles(filePath: string, source: string): InlineStyle[] {
  const sf = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  const out: InlineStyle[] = [];

  const visit = (node: ts.Node) => {
    // Match JSX attribute named 'style' whose initializer is `{{ ... }}`
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === 'style') {
      const init = node.initializer;
      if (init && ts.isJsxExpression(init) && init.expression
        && ts.isObjectLiteralExpression(init.expression)) {

        const props = parseObjectLiteral(init.expression, sf);
        if (props && props.size > 0) {
          const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          out.push({
            filePath,
            line: line + 1,
            column: character + 1,
            props,
            raw: node.getText(sf),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return out;
}

function parseObjectLiteral(
  obj: ts.ObjectLiteralExpression,
  sf: ts.SourceFile,
): Map<string, string | number> | null {
  const result = new Map<string, string | number>();

  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      // Spread, shorthand, computed: contains dynamic values — skip whole object
      return null;
    }
    const name = prop.name.getText(sf);
    const valueText = literalValue(prop.initializer);
    if (valueText === null) {
      // Dynamic value (variable, call, conditional, template-expr) — skip whole object
      return null;
    }
    result.set(name, valueText);
  }

  return result;
}

function literalValue(node: ts.Expression): string | number | null {
  // String literal: 'flex', "var(--gecko-primary-600)"
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  // Numeric literal: 12, 0.5
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  // Negative numeric: -1
  if (ts.isPrefixUnaryExpression(node)
    && node.operator === ts.SyntaxKind.MinusToken
    && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  // Template literal — if it has no expressions, treat as string
  if (ts.isTemplateExpression(node)) {
    return null;  // has expressions = dynamic
  }
  // Anything else (identifier, call, member access, conditional) = dynamic
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
   Crawler: walk src/ for *.tsx
   ────────────────────────────────────────────────────────────────────────── */

function* walk(dir: string): Generator<string> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', 'graphify-out', '.git'].includes(e.name)) continue;
      yield* walk(full);
    } else if (e.isFile() && full.endsWith('.tsx')) {
      yield full;
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Main
   ────────────────────────────────────────────────────────────────────────── */

function main() {
  console.log('Gecko Style-Catalog Detector');
  console.log('  src:    ', SRC_DIR);
  console.log('  output: ', OUTPUT_PATH);
  console.log('  signatures: ', SIGNATURES.length);
  console.log('');

  if (!fs.existsSync(SRC_DIR)) {
    console.error(`ERROR: source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }

  const allMatches: Match[] = [];
  const filesByMatches = new Map<string, Match[]>();
  let totalFiles = 0;
  let totalInlines = 0;

  for (const file of walk(SRC_DIR)) {
    totalFiles++;
    const source = fs.readFileSync(file, 'utf8');
    const inlines = extractInlineStyles(file, source);
    totalInlines += inlines.length;

    for (const inline of inlines) {
      // Try every signature; collect ALL matches (a single inline may match
      // multiple signatures — report the most-specific one only).
      const candidates: Match[] = [];
      for (const sig of SIGNATURES) {
        const m = tryMatch(inline, sig);
        if (m) candidates.push(m);
      }
      if (candidates.length === 0) continue;
      // Most-specific = most keys matched
      candidates.sort((a, b) => b.matchedKeys.length - a.matchedKeys.length);
      const best = candidates[0];
      allMatches.push(best);
      const rel = path.relative(REPO_ROOT, file);
      if (!filesByMatches.has(rel)) filesByMatches.set(rel, []);
      filesByMatches.get(rel)!.push(best);
    }
  }

  /* ── Write STYLE-AUDIT.md ───────────────────────────────────────────── */

  const sigCounts = new Map<string, number>();
  for (const m of allMatches) {
    sigCounts.set(m.signature.className, (sigCounts.get(m.signature.className) ?? 0) + 1);
  }

  const sortedSigs = [...sigCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sortedFiles = [...filesByMatches.entries()]
    .sort((a, b) => b[1].length - a[1].length);

  let md = '# Style-Catalog Audit\n\n';
  md += `**Generated**: ${new Date().toISOString()}\n`;
  md += `**Source**: \`${path.relative(REPO_ROOT, SRC_DIR)}\`\n`;
  md += `**Files scanned**: ${totalFiles}\n`;
  md += `**Inline \`style={{...}}\` blocks (static-only)**: ${totalInlines}\n`;
  md += `**Catalog-matchable violations**: **${allMatches.length}**\n`;
  md += `**Files with violations**: ${filesByMatches.size}\n\n`;
  md += '---\n\n';

  md += '## What this report shows\n\n';
  md += 'Each row below is an inline `style={{...}}` block whose key/value set\n';
  md += 'matches a known catalog signature in `scripts/style-catalog/signatures.ts`.\n';
  md += 'These are **mechanical** mappings — the inline can be replaced with the\n';
  md += 'listed catalog class without judgment.\n\n';
  md += 'Inline styles that do NOT appear here are either:\n';
  md += '  1. Dynamic (variables, conditionals, computed values) — should stay inline\n';
  md += '  2. A new pattern not yet in the signature map — add to §14 if recurring\n';
  md += '  3. A single-property override that no catalog class wraps\n\n';
  md += '---\n\n';

  /* Summary by signature */
  md += '## Summary by catalog class\n\n';
  md += '| Class | Catalog ref | Occurrences |\n';
  md += '|---|---|---:|\n';
  for (const [cls, count] of sortedSigs) {
    const sig = SIGNATURES.find(s => s.className === cls)!;
    md += `| \`.${cls}\` | ${sig.catalogRef} | **${count}** |\n`;
  }
  md += '\n---\n\n';

  /* Per-file detail */
  md += '## Files by violation count\n\n';
  for (const [file, matches] of sortedFiles) {
    md += `### \`${file}\` — ${matches.length} match${matches.length === 1 ? '' : 'es'}\n\n`;
    md += '| Line | Col | Suggested class | Matched signature |\n';
    md += '|---:|---:|---|---|\n';
    for (const m of matches) {
      md += `| ${m.inline.line} | ${m.inline.column} | \`.${m.signature.className}\` | ${m.signature.catalogRef} — ${m.signature.description} |\n`;
    }
    md += '\n';
  }

  fs.writeFileSync(OUTPUT_PATH, md, 'utf8');

  console.log(`Files scanned:                ${totalFiles}`);
  console.log(`Inline style blocks found:    ${totalInlines}`);
  console.log(`Catalog-matchable violations: ${allMatches.length}`);
  console.log(`Files with violations:        ${filesByMatches.size}`);
  console.log(``);
  console.log(`Top signatures:`);
  for (const [cls, count] of sortedSigs.slice(0, 10)) {
    console.log(`  ${count.toString().padStart(5)}  .${cls}`);
  }
  console.log(``);
  console.log(`Report written to: ${path.relative(REPO_ROOT, OUTPUT_PATH)}`);
}

main();
