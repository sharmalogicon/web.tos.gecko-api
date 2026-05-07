"use client";
import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

export interface BreadcrumbItem {
  /** Display label. */
  label: React.ReactNode;
  /** Optional href. Omit on the current/last item. */
  href?: string;
}

interface BreadcrumbProps {
  /** Ordered crumb list. The last item is rendered as the current page (no link). */
  items: BreadcrumbItem[];
  /** Separator icon name from the gecko Icon set. Default "chevronRight". */
  separator?: string;
  /** Extra class on the outer <nav>. */
  className?: string;
}

/**
 * Standard breadcrumb trail. Wraps the .gecko-breadcrumb classes from the
 * design system. Use on every detail page so users always know where they are.
 *
 * Usage:
 *   <Breadcrumb items={[
 *     { label: 'Masters',   href: '/masters'           },
 *     { label: 'Customers', href: '/masters/customers' },
 *     { label: 'TCL Electronics' }   // current — no href
 *   ]} />
 */
export function Breadcrumb({ items, separator = 'chevronRight', className = '' }: BreadcrumbProps) {
  return (
    <nav className={`gecko-breadcrumb ${className}`.trim()} aria-label="Breadcrumb">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {item.href && !isLast ? (
              <Link href={item.href} className="gecko-breadcrumb-item">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'gecko-breadcrumb-current' : 'gecko-breadcrumb-item'} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <span className="gecko-breadcrumb-sep" aria-hidden="true">
                <Icon name={separator} size={12} />
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
