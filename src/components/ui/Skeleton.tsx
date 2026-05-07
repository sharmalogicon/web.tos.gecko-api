"use client";
import React from 'react';

/**
 * Loading-skeleton primitives. Pure design-system classes; the shimmer
 * animation lives in gecko_design_system_components.css.
 *
 * Use these while async data is in flight to avoid layout shift when
 * the content arrives. Compose them to mimic the shape of the real UI.
 *
 *   <Skeleton.Text lines={3} />
 *   <Skeleton.Avatar size="lg" />
 *   <Skeleton.Card />
 *   <Skeleton.TableRow columns={5} />
 *   <Skeleton.Block width={120} height={32} />
 */

type TextSize = 'sm' | 'md' | 'lg' | 'xl';
const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  sm: 'gecko-skeleton-text-sm',
  md: '',
  lg: 'gecko-skeleton-text-lg',
  xl: 'gecko-skeleton-text-xl',
};

interface TextProps  { lines?: number; size?: TextSize; className?: string; }
interface AvatarProps { size?: 'sm' | 'md' | 'lg'; className?: string; }
interface BlockProps { width?: number | string; height?: number | string; className?: string; radius?: number | string; }
interface TableRowProps { columns?: number; className?: string; }

function Text({ lines = 1, size = 'md', className = '' }: TextProps) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`gecko-skeleton gecko-skeleton-text ${TEXT_SIZE_CLASS[size]}`.trim()}
          style={{
            // Last line is shorter, like real prose — no colour, just width
            width: lines > 1 && i === lines - 1 ? '70%' : '100%',
            marginTop: i === 0 ? 0 : 6,
          }}
        />
      ))}
    </div>
  );
}

function Avatar({ size = 'md', className = '' }: AvatarProps) {
  const px = size === 'sm' ? 24 : size === 'lg' ? 56 : 40;
  return (
    <div
      className={`gecko-skeleton gecko-skeleton-avatar ${className}`.trim()}
      style={{ width: px, height: px }}
    />
  );
}

function Card({ className = '' }: { className?: string }) {
  return <div className={`gecko-skeleton gecko-skeleton-card ${className}`.trim()} />;
}

function Block({ width = '100%', height = 16, className = '', radius }: BlockProps) {
  return (
    <div
      className={`gecko-skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

function TableRow({ columns = 4, className = '' }: TableRowProps) {
  return (
    <div className={`gecko-skeleton-table-row ${className}`.trim()}>
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="gecko-skeleton gecko-skeleton-text" />
      ))}
    </div>
  );
}

export const Skeleton = { Text, Avatar, Card, Block, TableRow };
