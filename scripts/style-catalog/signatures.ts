/**
 * Style-catalog signature map.
 *
 * Each entry defines an inline `style={{...}}` key-value signature and the
 * `.gecko-*` class that should replace it. The detector hashes each inline
 * style object and matches against these signatures.
 *
 * Mapping precedence: longer / more-specific signatures win over shorter
 * ones. The detector tries every signature; ambiguous matches are reported
 * but not auto-fixed.
 *
 * Signature schema:
 *   props: { [propName]: <expected value(s)> }
 *     - string             — exact match (e.g. 'var(--gecko-primary-600)')
 *     - number             — exact numeric match (e.g. 12)
 *     - string[]           — any of (e.g. ['10', '10.5'] — accepts drift)
 *     - { in: [...] }      — verbose any-of
 *     - true               — key must exist with ANY value
 *
 *   propsExact?: boolean   — when true, the object MUST contain ONLY these
 *                            props (no extras). When false (default), the
 *                            object may contain additional unknown props.
 *
 * Add new signatures here as they're discovered. This file is the
 * extensibility hook for §14 catalog growth.
 */

export interface Signature {
  /** Catalog class to apply. */
  className: string;
  /** Section reference in STYLE-CATALOG.md / gecko_design_system_components.css. */
  catalogRef: string;
  /** Human-readable description of what this pattern represents. */
  description: string;
  /** Property set that must match. */
  props: Record<string, PropMatcher>;
  /** If true, the inline object must contain ONLY these keys (strict). */
  propsExact?: boolean;
  /** Minimum number of matching props required (default: all keys in props). */
  minMatch?: number;
}

export type PropMatcher =
  | string
  | number
  | true
  | (string | number)[]
  | { in: (string | number)[] };

/* ──────────────────────────────────────────────────────────────────────────
   The signature catalog. Ordered roughly by specificity (most-specific first
   so ambiguous matches go to the more-specific class).
   ────────────────────────────────────────────────────────────────────────── */

export const SIGNATURES: Signature[] = [
  /* ── §7.1 .gecko-id-link — booking/container/BL/EIR/invoice link ────── */
  {
    className: 'gecko-id-link',
    catalogRef: '§7.1',
    description: 'Identifier link (BL / booking / container / invoice # in mono)',
    props: {
      fontFamily: 'var(--gecko-font-mono)',
      fontSize: [12, '12px'],
      fontWeight: [700, '700'],
      color: ['var(--gecko-primary-600)', 'var(--gecko-primary-700)'],
      letterSpacing: ['0.01em', '0.02em'],
    },
  },

  /* ── §7.3 .gecko-cell-sub — mono sub-line under primary cell value ──── */
  {
    className: 'gecko-cell-sub',
    catalogRef: '§7.3',
    description: 'Cell sub-line (order#, code, voyage — mono small grey)',
    props: {
      fontFamily: 'var(--gecko-font-mono)',
      fontSize: [10, 10.5, '10px', '10.5px'],
      color: [
        'var(--gecko-text-disabled)',
        'var(--gecko-text-secondary)',
      ],
      marginTop: [1, 2, '1px', '2px'],
    },
    minMatch: 3,
  },

  /* ── §7.4 .gecko-cell-meta — non-mono meta sub-line ──────────────────── */
  {
    className: 'gecko-cell-meta',
    catalogRef: '§7.4',
    description: 'Cell meta sub-line (non-mono — date hint, order type, etc.)',
    props: {
      fontSize: [10, 11, '10px', '11px'],
      color: 'var(--gecko-text-secondary)',
      marginTop: [2, 3, '2px', '3px'],
    },
    minMatch: 2,
  },

  /* ── §7.5 .gecko-eyebrow — uppercase section label ───────────────────── */
  {
    className: 'gecko-eyebrow',
    catalogRef: '§7.5',
    description: 'Eyebrow (uppercase small-caps section label)',
    props: {
      fontSize: [10, 11, '10px', '11px'],
      fontWeight: [600, 700, '600', '700'],
      color: 'var(--gecko-text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: ['0.04em', '0.05em', '0.06em', '0.07em', '0.08em', '0.09em'],
    },
    minMatch: 4,
  },

  /* ── §7.6 .gecko-page-title — h1 22px ────────────────────────────────── */
  {
    className: 'gecko-page-title',
    catalogRef: '§7.6',
    description: 'Page-level h1 (22px / 700 / -0.02em letter-spacing)',
    props: {
      fontSize: [22, '22px'],
      fontWeight: [700, '700'],
      letterSpacing: '-0.02em',
    },
    minMatch: 3,
  },

  /* ── §7.7 .gecko-page-title-lg — h1 26px (dashboards) ────────────────── */
  {
    className: 'gecko-page-title-lg',
    catalogRef: '§7.7',
    description: 'Dashboard-level h1 (26px / 700)',
    props: {
      fontSize: [26, 24, '26px', '24px'],
      fontWeight: [700, '700'],
      letterSpacing: '-0.02em',
    },
    minMatch: 3,
  },

  /* ── §7.8 .gecko-page-subtitle ───────────────────────────────────────── */
  {
    className: 'gecko-page-subtitle',
    catalogRef: '§7.8',
    description: 'Page descriptive subtitle (13 secondary)',
    props: {
      fontSize: [12, 13, '12px', '13px'],
      color: 'var(--gecko-text-secondary)',
    },
    propsExact: true,
    minMatch: 2,
  },

  /* ── §7.9 .gecko-card-title ──────────────────────────────────────────── */
  {
    className: 'gecko-card-title',
    catalogRef: '§7.9',
    description: 'Card heading (14 / 600 / text-primary)',
    props: {
      fontSize: [14, '14px'],
      fontWeight: [600, '600'],
      color: 'var(--gecko-text-primary)',
    },
    propsExact: true,
  },

  /* ── §7.11 .gecko-stat-num — KPI value (26px) ────────────────────────── */
  {
    className: 'gecko-stat-num',
    catalogRef: '§7.11',
    description: 'KPI/stat number (26 / 700 / line-1 / mono)',
    props: {
      fontSize: [26, '26px'],
      fontWeight: [700, 800, '700', '800'],
      lineHeight: [1, '1'],
    },
    minMatch: 2,
  },

  /* ── §13.6 .gecko-stat-num-22 — sidebar dense variant ────────────────── */
  {
    className: 'gecko-stat-num gecko-stat-num-22',
    catalogRef: '§13.6',
    description: 'Stat number sidebar variant (22 / 700)',
    props: {
      fontSize: [22, '22px'],
      fontWeight: [700, 800, '700', '800'],
      lineHeight: [1, '1'],
    },
    minMatch: 2,
  },

  /* ── §7.12 .gecko-stat-label ─────────────────────────────────────────── */
  {
    className: 'gecko-stat-label',
    catalogRef: '§7.12',
    description: 'KPI/stat label (11 / 600 / uppercase / text-secondary)',
    props: {
      fontSize: [11, '11px'],
      fontWeight: [600, '600'],
      color: 'var(--gecko-text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: ['0.05em', '0.06em', '0.07em', '0.08em'],
    },
    minMatch: 4,
  },

  /* ── §7.13 .gecko-money — currency right-aligned mono ────────────────── */
  {
    className: 'gecko-money',
    catalogRef: '§7.13',
    description: 'Currency cell (right / mono / 700+)',
    props: {
      fontFamily: 'var(--gecko-font-mono)',
      fontWeight: [700, 800, '700', '800'],
      textAlign: 'right',
    },
    minMatch: 3,
  },

  /* ── §7.15 .gecko-mono-strong — mono identifier (non-link) ───────────── */
  {
    className: 'gecko-mono-strong',
    catalogRef: '§7.15',
    description: 'Mono identifier non-link (11 / 600 / text-primary)',
    props: {
      fontFamily: 'var(--gecko-font-mono)',
      fontSize: [11, '11px'],
      fontWeight: [600, '600'],
      color: 'var(--gecko-text-primary)',
    },
    propsExact: true,
  },

  /* ── §7.16 .gecko-truncate ───────────────────────────────────────────── */
  {
    className: 'gecko-truncate',
    catalogRef: '§7.16',
    description: 'Text truncation (overflow + ellipsis + nowrap)',
    props: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    propsExact: true,
  },

  /* ── §7.2 .gecko-cell-primary — main 2-line cell primary value ───────── */
  {
    className: 'gecko-cell-primary',
    catalogRef: '§7.2',
    description: 'Cell primary value (12 / 600 / text-primary)',
    props: {
      fontSize: [12, '12px'],
      fontWeight: [600, '600'],
      color: 'var(--gecko-text-primary)',
    },
    propsExact: true,
  },

  /* ── §7.18 .gecko-form-label ─────────────────────────────────────────── */
  {
    className: 'gecko-form-label',
    catalogRef: '§7.18',
    description: 'Form field label (13 / 500 / text-primary)',
    props: {
      fontSize: [13, '13px'],
      fontWeight: [500, '500'],
      color: 'var(--gecko-text-primary)',
    },
    propsExact: true,
  },

  /* ── §7.17 .gecko-helper-text ────────────────────────────────────────── */
  {
    className: 'gecko-helper-text',
    catalogRef: '§7.17',
    description: 'Form helper hint (11 / text-disabled / marginTop 4)',
    props: {
      fontSize: [11, '11px'],
      color: 'var(--gecko-text-disabled)',
      marginTop: [4, '4px'],
    },
    minMatch: 3,
  },

  /* ── §8.1 .gecko-stack — flex column with default gap 12 ─────────────── */
  {
    className: 'gecko-stack',
    catalogRef: '§8.1',
    description: 'Vertical flex stack (default gap 12)',
    props: {
      display: 'flex',
      flexDirection: 'column',
      gap: [12, '12px'],
    },
    propsExact: true,
  },
  {
    className: 'gecko-stack gecko-stack-sm',
    catalogRef: '§8.1',
    description: 'Vertical flex stack with sm gap (8px)',
    props: {
      display: 'flex',
      flexDirection: 'column',
      gap: [8, '8px'],
    },
    propsExact: true,
  },
  {
    className: 'gecko-stack gecko-stack-lg',
    catalogRef: '§8.1',
    description: 'Vertical flex stack with lg gap (16px)',
    props: {
      display: 'flex',
      flexDirection: 'column',
      gap: [16, '16px'],
    },
    propsExact: true,
  },
  {
    className: 'gecko-stack gecko-stack-xl',
    catalogRef: '§8.1',
    description: 'Vertical flex stack with xl gap (24px)',
    props: {
      display: 'flex',
      flexDirection: 'column',
      gap: [24, '24px'],
    },
    propsExact: true,
  },

  /* ── §8.2 .gecko-row — flex horizontal items-center gap 8 ────────────── */
  {
    className: 'gecko-row',
    catalogRef: '§8.2',
    description: 'Horizontal flex row (default gap 8 / items-center)',
    props: {
      display: 'flex',
      alignItems: 'center',
      gap: [8, '8px'],
    },
    propsExact: true,
  },
  {
    className: 'gecko-row gecko-row-between',
    catalogRef: '§8.2',
    description: 'Row with justify-between',
    props: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    propsExact: true,
  },
  {
    className: 'gecko-row gecko-row-end',
    catalogRef: '§8.2',
    description: 'Row with justify-flex-end',
    props: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    propsExact: true,
  },
  {
    className: 'gecko-row gecko-row-baseline',
    catalogRef: '§8.2',
    description: 'Row with items-baseline',
    props: {
      display: 'flex',
      alignItems: 'baseline',
      gap: [8, '8px'],
    },
    propsExact: true,
  },

  /* ── §8.3 .gecko-grid-N ──────────────────────────────────────────────── */
  {
    className: 'gecko-grid-2',
    catalogRef: '§8.3',
    description: '2-column equal grid',
    props: {
      display: 'grid',
      gridTemplateColumns: ['1fr 1fr', 'repeat(2, 1fr)'],
    },
    propsExact: true,
  },
  {
    className: 'gecko-grid-3',
    catalogRef: '§8.3',
    description: '3-column equal grid',
    props: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
    },
    propsExact: true,
  },
  {
    className: 'gecko-grid-4',
    catalogRef: '§8.3',
    description: '4-column equal grid',
    props: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
    propsExact: true,
  },
  {
    className: 'gecko-grid-5',
    catalogRef: '§8.3',
    description: '5-column equal grid',
    props: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
    },
    propsExact: true,
  },

  /* ── §8.4 .gecko-flex-1 ──────────────────────────────────────────────── */
  {
    className: 'gecko-flex-1',
    catalogRef: '§8.4',
    description: 'Flex grow + min-width 0',
    props: {
      flex: [1, '1'],
      minWidth: [0, '0', '0px'],
    },
    propsExact: true,
  },

  /* ── §8.5 .gecko-inline-row — inline-flex icon+text ──────────────────── */
  {
    className: 'gecko-inline-row',
    catalogRef: '§8.5',
    description: 'Inline-flex row with gap 6',
    props: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: [6, '6px'],
    },
    propsExact: true,
  },

  /* ── §9.2 .gecko-mini-icon-<tone> — 32px tinted icon container ───────── */
  {
    className: 'gecko-mini-icon gecko-mini-icon-primary',
    catalogRef: '§9.2',
    description: '32px primary-tinted icon container',
    props: {
      width: [32, '32px'],
      height: [32, '32px'],
      borderRadius: [8, '8px'],
      background: 'var(--gecko-primary-50)',
      color: 'var(--gecko-primary-700)',
      display: ['flex', 'inline-flex'],
      alignItems: 'center',
      justifyContent: 'center',
    },
    minMatch: 6,
  },
  {
    className: 'gecko-mini-icon gecko-mini-icon-success',
    catalogRef: '§9.2',
    description: '32px success-tinted icon container',
    props: {
      width: [32, '32px'],
      height: [32, '32px'],
      borderRadius: [8, '8px'],
      background: 'var(--gecko-success-50)',
      color: 'var(--gecko-success-700)',
    },
    minMatch: 4,
  },
  {
    className: 'gecko-mini-icon gecko-mini-icon-warning',
    catalogRef: '§9.2',
    description: '32px warning-tinted icon container',
    props: {
      width: [32, '32px'],
      height: [32, '32px'],
      borderRadius: [8, '8px'],
      background: 'var(--gecko-warning-50)',
      color: 'var(--gecko-warning-700)',
    },
    minMatch: 4,
  },
  {
    className: 'gecko-mini-icon gecko-mini-icon-info',
    catalogRef: '§9.2',
    description: '32px info-tinted icon container',
    props: {
      width: [32, '32px'],
      height: [32, '32px'],
      borderRadius: [8, '8px'],
      background: 'var(--gecko-info-50)',
      color: 'var(--gecko-info-700)',
    },
    minMatch: 4,
  },
  {
    className: 'gecko-mini-icon gecko-mini-icon-error',
    catalogRef: '§9.2',
    description: '32px error-tinted icon container',
    props: {
      width: [32, '32px'],
      height: [32, '32px'],
      borderRadius: [8, '8px'],
      background: 'var(--gecko-error-50)',
      color: 'var(--gecko-error-700)',
    },
    minMatch: 4,
  },

  /* ── §9.8 .gecko-action-toolbar — right-aligned action row ───────────── */
  {
    className: 'gecko-action-toolbar',
    catalogRef: '§9.8',
    description: 'Action toolbar (right-aligned button row)',
    props: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: [8, '8px'],
    },
    propsExact: true,
  },
];
