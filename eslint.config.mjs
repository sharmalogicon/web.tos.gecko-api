import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/* ──────────────────────────────────────────────────────────────────────────
   Gecko style-catalog enforcement.

   Surface inline `style={{...}}` JSX attributes that contain STATIC visual
   properties — these violate the rule "all visual patterns live in
   gecko_design_system_*.css". Dynamic computed values (variable refs,
   conditionals, template strings with expressions, member access) are NOT
   flagged.

   See STYLE-CATALOG.md §11 — Usage rules + ESLint.

   Severity: 'warn' for the duration of the inline-style migration.
   Will be flipped to 'error' once Phase C page refactor is complete.
   ────────────────────────────────────────────────────────────────────────── */

const STATIC_VISUAL_PROPS = [
  "background", "backgroundColor",
  "color",
  "border", "borderRadius", "borderColor", "borderStyle", "borderWidth",
  "borderTop", "borderBottom", "borderLeft", "borderRight",
  "padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",
  "fontSize", "fontWeight", "fontFamily", "letterSpacing", "lineHeight",
  "textTransform", "textAlign",
  "display", "flexDirection", "alignItems", "justifyContent", "gap",
  "flexWrap",
  "boxShadow",
  "marginTop", "marginBottom",
].join("|");

// AST selector — flags `style={{ <key>: <Literal> }}` where key is a static
// visual property and the value is a string / number literal.
// Identifiers, member expressions, template literals with expressions, and
// conditional expressions are NOT matched.
const inlineStaticStyleSelector =
  `JSXAttribute[name.name='style'] ` +
  `ObjectExpression > Property[key.name=/^(${STATIC_VISUAL_PROPS})$/]` +
  `[value.type='Literal']`;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: inlineStaticStyleSelector,
          message:
            "Static inline style detected. Move to a class in " +
            "gecko_design_system_components.css (see STYLE-CATALOG.md §11). " +
            "Inline style is only allowed for dynamic computed values.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Mock data files contain no JSX, exempt anyway.
    "src/lib/**/*.ts",
    // Print template uses many positional inline styles by design.
    "src/components/print/**",
    // Generator script (not part of the app build).
    "demo-slides/**",
    // graphify cache + tooling artifacts.
    "src/graphify-out/**",
    // The June 2026 screens, kept VERBATIM at commit 5f82606 so the rebuilds
    // can be read against them. They predate the React Compiler rules and must
    // not be "fixed": an edited reference is no longer a reference. Nothing
    // under /compare calls the API or ships in a menu.
    "src/app/compare/**",
  ]),
]);

export default eslintConfig;
