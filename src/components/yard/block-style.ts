/**
 * HOW A YARD BLOCK IS DRAWN. One set of rules, two screens.
 *
 * The layout editor (Configuration → Yard Zones & Blocks) and Yard at a Glance
 * draw the same yard — one to move the blocks, one to colour them by what is in
 * them — and they must draw it the SAME. When each had its own copy of the
 * geometry they drifted: the editor sized a block from its bays and rows while
 * the dashboard read a saved width, so a block was one size while being placed
 * and another while being watched.
 *
 * Positions and sizes are in GRID PIXELS, which is what the API stores in
 * layout_x / layout_y / layout_width / layout_height. One grid cell is one
 * ground slot, so a 12-bay × 6-row block is 240 × 120 unless somebody has
 * stretched it on the canvas.
 */
import type { BlockType } from '@/lib/api/yard-map';

/** One grid cell = one ground slot. Everything snaps to it. */
export const GRID_PX = 20;
/** The yard canvas, in grid pixels: 70 × 45 cells. */
export const CANVAS_W = 1400;
export const CANVAS_H = 900;

export interface BlockStyle {
  label: string;
  fill: string;
  stroke: string;
  text: string;
}

/**
 * The colour each block type is drawn in, and what it is called on screen.
 *
 * These are the eight values org.yard_block.block_type allows
 * (ck_yard_block__type); anything else is a block the API would refuse.
 */
export const TYPE_STYLE: Record<BlockType, BlockStyle> = {
  IMPORT:       { label: 'Import',  fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a' },
  EXPORT:       { label: 'Export',  fill: '#d1fae5', stroke: '#059669', text: '#064e3b' },
  EMPTY:        { label: 'Empty',   fill: '#f3f4f6', stroke: '#6b7280', text: '#374151' },
  REEFER:       { label: 'Reefer',  fill: '#cffafe', stroke: '#0891b2', text: '#155e75' },
  DAMAGE:       { label: 'Damage',  fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
  HAZ:          { label: 'HAZ',     fill: '#ffedd5', stroke: '#ea580c', text: '#7c2d12' },
  OOG:          { label: 'OOG',     fill: '#ede9fe', stroke: '#7c3aed', text: '#4c1d95' },
  TRANSHIPMENT: { label: 'T/S',     fill: '#fef3c7', stroke: '#d97706', text: '#78350f' },
};

/** A block with no type at all. Grey, and named for what it is. */
export const UNTYPED_STYLE: BlockStyle = { label: 'No type', fill: '#f9fafb', stroke: '#9ca3af', text: '#4b5563' };

/** What a block type is called. A block need not have one. */
export const typeLabel = (type: BlockType | null | undefined): string =>
  type ? TYPE_STYLE[type]?.label ?? type : UNTYPED_STYLE.label;

/** Everything the drawing rules need off a block — both reads supply it. */
export interface DrawnBlock {
  blockType: BlockType | null;
  maxRows: number | null;
  maxBays: number | null;
  layoutX: number | null;
  layoutY: number | null;
  layoutWidth: number | null;
  layoutHeight: number | null;
  displayColorHex: string | null;
}

/** A block that has never been placed: it is in the tray, not on the map. */
export const isPlaced = (b: Pick<DrawnBlock, 'layoutX' | 'layoutY'>): boolean =>
  b.layoutX !== null && b.layoutY !== null;

/** Bays and rows when nobody has said how many — a block has to have a size to be dragged. */
const DEFAULT_BAYS = 6;
const DEFAULT_ROWS = 4;

/**
 * Where a block sits and how big it is.
 *
 * The saved width and height win: once somebody has stretched a block on the
 * canvas, that is the yard as they drew it. Without them the size comes from
 * the block's own bays × rows, one cell each, which is the yard as master data
 * describes it.
 */
export function blockBox(b: DrawnBlock): { x: number; y: number; w: number; h: number } {
  return {
    x: b.layoutX ?? 0,
    y: b.layoutY ?? 0,
    w: b.layoutWidth ?? (b.maxBays ?? DEFAULT_BAYS) * GRID_PX,
    h: b.layoutHeight ?? (b.maxRows ?? DEFAULT_ROWS) * GRID_PX,
  };
}

/**
 * The colour a block is drawn in: its own `displayColorHex` if the depot chose
 * one, else its type's colour, else grey.
 *
 * A chosen colour gives the outline and the lettering; the fill is the same
 * colour at low alpha, so the block reads as that colour without the code
 * inside it going unreadable on a dark one.
 */
export function blockStyle(b: Pick<DrawnBlock, 'blockType' | 'displayColorHex'>): BlockStyle {
  const hex = b.displayColorHex?.trim();
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return { label: typeLabel(b.blockType), fill: `${hex}26`, stroke: hex, text: hex };
  }
  return b.blockType ? TYPE_STYLE[b.blockType] ?? UNTYPED_STYLE : UNTYPED_STYLE;
}

/** Snap a coordinate to the grid, and never off the canvas. */
export function snap(v: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(v / GRID_PX) * GRID_PX));
}
