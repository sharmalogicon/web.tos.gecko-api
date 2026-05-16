/**
 * Demo data seeder
 * ────────────────
 * Re-seeds localStorage to a known-good demo state. Safety net for the YC /
 * client demo so a fresh browser or wiped storage doesn't kill the live walk.
 *
 * What gets seeded:
 *   - Yard template (so /config/yard-zones, /gate/yard-view, and
 *     /dashboard/yard-glance all light up)
 *
 * Idempotent: calling multiple times produces the same state.
 */

interface YardBlock {
  id: string; code: string;
  type: 'IMPORT' | 'EXPORT' | 'EMPTY' | 'REEFER' | 'DAMAGE' | 'HAZ' | 'OOG' | 'TRANSHIPMENT';
  bays: number; rows: number; tiers: number;
  x: number; y: number;
  allocation: 'OPEN' | 'LINE_RESERVED' | 'AGENT_RESERVED' | 'CUSTOMER_RESERVED';
  reservedParty: string;
  isoAccepted: string[];
  reeferPlugCount: number;
}

interface YardTemplate {
  version: 1; yardId: string; name: string; savedAt: string;
  canvas: { width: number; height: number; gridPx: number };
  blocks: YardBlock[];
}

const YARD_STORAGE_KEY = 'gecko.yardTemplate.lcb.import-yard';

// 16-block yard layout. Realistic mix of block types covering Import / Export /
// Empty / Reefer / HAZ / OOG / Damage / Transhipment so every lens has something
// to show. Coordinates land on a 20px grid; canvas is 1400×900.
const DEMO_YARD: YardTemplate = {
  version: 1,
  yardId: 'lcb-icd-yard-a',
  name: 'Laem Chabang ICD — Yard A',
  savedAt: new Date().toISOString(),
  canvas: { width: 1400, height: 900, gridPx: 20 },
  blocks: [
    // Row 1 — Import (4 blocks)
    { id: 'b-imp-1', code: 'IMP-A1', type: 'IMPORT',  bays: 12, rows: 6, tiers: 4, x:  60, y:  60, allocation: 'OPEN',           reservedParty: '',           isoAccepted: ['20GP', '40GP', '40HC'], reeferPlugCount: 0  },
    { id: 'b-imp-2', code: 'IMP-A2', type: 'IMPORT',  bays: 12, rows: 6, tiers: 4, x: 360, y:  60, allocation: 'LINE_RESERVED',  reservedParty: 'MAERSK',     isoAccepted: ['20GP', '40GP', '40HC'], reeferPlugCount: 0  },
    { id: 'b-imp-3', code: 'IMP-A3', type: 'IMPORT',  bays: 10, rows: 6, tiers: 4, x: 660, y:  60, allocation: 'LINE_RESERVED',  reservedParty: 'ONE',        isoAccepted: ['20GP', '40HC'],         reeferPlugCount: 0  },
    { id: 'b-imp-4', code: 'IMP-A4', type: 'IMPORT',  bays: 10, rows: 6, tiers: 4, x: 920, y:  60, allocation: 'OPEN',           reservedParty: '',           isoAccepted: ['20GP', '40GP', '40HC'], reeferPlugCount: 0  },

    // Row 2 — Export (4 blocks)
    { id: 'b-exp-1', code: 'EXP-B1', type: 'EXPORT',  bays: 12, rows: 6, tiers: 4, x:  60, y: 240, allocation: 'OPEN',           reservedParty: '',           isoAccepted: ['20GP', '40GP', '40HC'], reeferPlugCount: 0  },
    { id: 'b-exp-2', code: 'EXP-B2', type: 'EXPORT',  bays: 12, rows: 6, tiers: 4, x: 360, y: 240, allocation: 'CUSTOMER_RESERVED', reservedParty: 'Thai Union Group', isoAccepted: ['20GP', '40HC'], reeferPlugCount: 0 },
    { id: 'b-exp-3', code: 'EXP-B3', type: 'EXPORT',  bays: 10, rows: 6, tiers: 4, x: 660, y: 240, allocation: 'OPEN',           reservedParty: '',           isoAccepted: ['20GP', '40GP', '40HC'], reeferPlugCount: 0  },
    { id: 'b-exp-4', code: 'EXP-B4', type: 'EXPORT',  bays: 10, rows: 6, tiers: 4, x: 920, y: 240, allocation: 'AGENT_RESERVED', reservedParty: 'CMA-CGM',    isoAccepted: ['20GP', '40HC'],         reeferPlugCount: 0  },

    // Row 3 — Specials: 2 Reefer, 1 HAZ, 1 OOG
    { id: 'b-rf-1',  code: 'RF-C1',  type: 'REEFER',  bays:  8, rows: 4, tiers: 3, x:  60, y: 420, allocation: 'OPEN',           reservedParty: '',           isoAccepted: ['20RF', '40RF'],         reeferPlugCount: 32 },
    { id: 'b-rf-2',  code: 'RF-C2',  type: 'REEFER',  bays:  8, rows: 4, tiers: 3, x: 280, y: 420, allocation: 'LINE_RESERVED',  reservedParty: 'MAERSK',     isoAccepted: ['20RF', '40RF'],         reeferPlugCount: 24 },
    { id: 'b-haz-1', code: 'HAZ-D1', type: 'HAZ',     bays:  6, rows: 3, tiers: 2, x: 500, y: 420, allocation: 'OPEN',           reservedParty: '',           isoAccepted: ['20GP'],                 reeferPlugCount: 0  },
    { id: 'b-oog-1', code: 'OOG-D1', type: 'OOG',     bays:  6, rows: 3, tiers: 1, x: 680, y: 420, allocation: 'OPEN',           reservedParty: '',           isoAccepted: ['40HC', '45HC'],         reeferPlugCount: 0  },

    // Row 4 — Empty (3 blocks) + Damage
    { id: 'b-mt-1',  code: 'MT-E1',  type: 'EMPTY',   bays: 14, rows: 8, tiers: 5, x:  60, y: 580, allocation: 'OPEN',           reservedParty: '',           isoAccepted: ['20GP', '40GP', '40HC'], reeferPlugCount: 0  },
    { id: 'b-mt-2',  code: 'MT-E2',  type: 'EMPTY',   bays: 14, rows: 8, tiers: 5, x: 420, y: 580, allocation: 'LINE_RESERVED',  reservedParty: 'APL',        isoAccepted: ['20GP', '40GP'],         reeferPlugCount: 0  },
    { id: 'b-mt-3',  code: 'MT-E3',  type: 'EMPTY',   bays: 12, rows: 8, tiers: 5, x: 780, y: 580, allocation: 'LINE_RESERVED',  reservedParty: 'COSCO',      isoAccepted: ['20GP', '40HC'],         reeferPlugCount: 0  },
    { id: 'b-dm-1',  code: 'DM-F1',  type: 'DAMAGE',  bays:  6, rows: 4, tiers: 2, x: 1040, y: 580, allocation: 'OPEN',          reservedParty: '',           isoAccepted: ['20GP', '40GP'],         reeferPlugCount: 0  },

    // Row 5 — Transhipment
    { id: 'b-ts-1',  code: 'TS-G1',  type: 'TRANSHIPMENT', bays: 10, rows: 4, tiers: 4, x: 1170, y: 60, allocation: 'OPEN', reservedParty: '', isoAccepted: ['20GP', '40HC'], reeferPlugCount: 0 },
    { id: 'b-ts-2',  code: 'TS-G2',  type: 'TRANSHIPMENT', bays: 10, rows: 4, tiers: 4, x: 1170, y: 240, allocation: 'AGENT_RESERVED', reservedParty: 'PIL', isoAccepted: ['20GP'], reeferPlugCount: 0 },
  ],
};

export function isYardSeeded(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(YARD_STORAGE_KEY) !== null;
}

export function seedDemoData(): { seeded: boolean; message: string } {
  if (typeof window === 'undefined') {
    return { seeded: false, message: 'Not in a browser' };
  }
  try {
    localStorage.setItem(YARD_STORAGE_KEY, JSON.stringify({ ...DEMO_YARD, savedAt: new Date().toISOString() }));
    return { seeded: true, message: `Yard seeded — ${DEMO_YARD.blocks.length} blocks` };
  } catch (e) {
    return { seeded: false, message: e instanceof Error ? e.message : 'Failed to seed' };
  }
}

export function clearDemoData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(YARD_STORAGE_KEY);
}

/**
 * Auto-seed on first page load if no yard exists. Safe to call from anywhere
 * client-side. Wins the "fresh browser = empty demo" failure mode.
 */
export function autoSeedIfEmpty(): boolean {
  if (typeof window === 'undefined') return false;
  if (isYardSeeded()) return false;
  seedDemoData();
  return true;
}
