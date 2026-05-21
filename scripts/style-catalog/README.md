# Gecko Style-Catalog Codemod

The deterministic enforcement layer for the Gecko design system.

This is the **portable companion** to `gecko_design_system_*.css` + `STYLE-CATALOG.md`.
Every Gecko app (TOS, MNR, Trucking, My-portal, future) should adopt all three together.

---

## What it does

Scans every `.tsx` file under `src/` for inline `style={{...}}` JSX attributes
whose key/value set matches a known catalog signature, and reports them
with file/line/column + suggested catalog class.

**Why it exists**: AI agents miss patterns in deeply-nested table cells. A
deterministic AST script doesn't. The agents and the codemod are complementary
— agents for chrome + judgment calls, codemod for exhaustive pattern matching.

## How to run

```bash
# Report-only mode (writes STYLE-AUDIT.md at the repo root)
npm run audit:styles

# Or scan a different folder
npx tsx scripts/style-catalog/detect.ts --src=src/app/bookings

# Or write the report somewhere else
npx tsx scripts/style-catalog/detect.ts --out=path/to/AUDIT.md
```

No runtime code is changed. The detector is safe to run on any branch
at any time.

## What the output looks like

`STYLE-AUDIT.md` at the repo root contains:

1. **Summary by catalog class** — which `.gecko-*` classes are needed most
2. **Files by violation count** — sorted, with file:line:col + suggested class for each violation

You read the audit, optionally trust the suggestions, and apply them with
a search-and-replace or a hand-edit per row. Future Phase B will add a
`--fix` flag that performs the replacement mechanically.

## Architecture

```
scripts/style-catalog/
├── detect.ts            ← entry point (the codemod itself)
├── signatures.ts        ← catalog signature map (extensibility hook)
└── README.md            ← this file
```

**`signatures.ts`** is the heart of the codemod. Each entry defines:
- the inline-style key/value set that constitutes a "signature"
- the `.gecko-*` class that replaces it
- the catalog section reference (§7.x / §8.x / §9.x / §13.x)
- a human-readable description

When a new pattern is added to `gecko_design_system_components.css`, add
the corresponding entry in `signatures.ts`. From that commit forward, the
detector finds every place the pattern should be applied.

## Why no external dependencies

`detect.ts` uses only:
- Node.js `fs` / `path` (stdlib)
- TypeScript's compiler API (`typescript` is already a devDep in every
  Gecko app's `package.json`)

No `jscodeshift`, no `@babel/parser`, no new packages. The codemod is
self-contained, portable, and runs in any Gecko app folder without
configuration.

## Cross-app adoption — the canonical workflow

The whole point of the catalog + codemod is that every Gecko product
runs the same enforcement.

### To adopt in a new Gecko app

1. **Copy the 6 design-system CSS files**:
   ```
   src/app/gecko_design_system.css
   src/app/gecko_design_system_tokens.css
   src/app/gecko_design_system_base.css
   src/app/gecko_design_system_layout.css
   src/app/gecko_design_system_components.css
   src/app/gecko_design_system_print.css
   ```
   into the target app's `src/app/`.

2. **Copy the codemod**:
   ```
   scripts/style-catalog/
   ├── detect.ts
   ├── signatures.ts
   └── README.md
   ```
   into the target app's `scripts/`.

3. **Copy the catalog docs**:
   ```
   STYLE-CATALOG.md
   STYLE-DEBT.md   ← optional, regenerated per app
   ```
   into the target app's repo root.

4. **Add npm script** to the target app's `package.json`:
   ```json
   "scripts": {
     "audit:styles": "tsx scripts/style-catalog/detect.ts"
   }
   ```

5. **Run the audit**:
   ```bash
   npm run audit:styles
   ```
   → produces `STYLE-AUDIT.md` showing every catalog-matchable violation
     in that specific app.

6. **Apply the suggested classes** (file by file, mechanical replacements).

7. **Re-run** to verify the count drops to zero (for the catalog-matchable
   subset).

### What stays in sync across apps

| File | Apps | Sync policy |
|---|---|---|
| `gecko_design_system_*.css` (6 files) | TOS, MNR, Trucking, My-portal, ... | **Byte-identical** across all apps. TOS is the canonical source. |
| `scripts/style-catalog/signatures.ts` | All | **Byte-identical**. New signatures added in TOS first, then synced. |
| `scripts/style-catalog/detect.ts` | All | **Byte-identical**. |
| `STYLE-CATALOG.md` | All | **Byte-identical**. |
| `STYLE-AUDIT.md` | All | **App-specific**. Regenerated locally per app. |
| `STYLE-DEBT.md` | TOS only (so far) | Can be regenerated per app from the audit output. |

### When the catalog grows (§14, §15, …)

1. Add the new CSS class in `gecko_design_system_components.css` in TOS (canonical)
2. Add the matching signature entry in `scripts/style-catalog/signatures.ts`
3. Document in `STYLE-CATALOG.md` §14
4. Run `npm run audit:styles` in TOS — find every existing inline that
   matches the new signature
5. Apply fixes in TOS
6. Sync the 6 CSS files + signatures.ts + STYLE-CATALOG.md to the other apps
7. Run `npm run audit:styles` in each other app — apply fixes locally

## Limitations

The detector finds inline styles whose VALUES ARE LITERAL ONLY. It deliberately
skips any inline object that contains:

- A variable reference (`color: someVar`)
- A conditional (`background: open ? 'a' : 'b'`)
- A computed expression (`width: pct + '%'`)
- A template literal with expressions
- A spread (`{ ...someStyle }`)
- A method call result

These are the **legitimately dynamic** styles that should stay inline per the
catalog rules (§11 of STYLE-CATALOG.md). The codemod respects the contract.

If a property's value happens to match a signature but uses a variable, the
codemod won't flag it — that's correct behaviour, not a miss.

## Future phases

- **Phase B** — `--fix` flag that applies the replacement mechanically (write
  back to disk, build verify, commit per batch).
- **Phase C** — pre-commit hook via `husky` so new code with a catalog-matchable
  inline gets auto-fixed before it lands.
- **Phase D** — wire the same signature map into an ESLint plugin so the IDE
  shows the suggested class on hover.

---

Built with TypeScript. Zero external runtime deps. ~400 lines of code.
