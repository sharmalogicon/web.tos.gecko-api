"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from './Icon';
import { problemOf } from '@/lib/api/problem';
import { useSession } from '@/lib/auth/session';

/**
 * WHAT WENT WRONG, IN WORDS A CLERK CAN ACT ON.
 *
 * On 2026-10-31 a GECKO pick-up failed at the barrier and the screen said only
 * "An error occurred while processing your request. Nothing was charged." The
 * clerk could not tell what was wrong, whom to ask, or whether pressing Save
 * again would charge the customer twice. The cause — the depot had no receipt
 * number series — was in the server's log and nowhere else.
 *
 * So every failed write renders THIS: the server's own title as the heading,
 * its detail underneath, and on a 5xx the reference its log line carries, so
 * support can find the one request that broke. No stack traces, no JSON, and
 * never a sentence this component invented about money.
 *
 * `heading` / `detail` override the server's words where a screen has something
 * better to say about a status it expects (a 404 that means "the link is
 * stale"). Everything else — the reference, the number-series link, the retry —
 * is the same everywhere on purpose.
 */
export interface ErrorBannerProps {
  /** An ApiError, or whatever a catch block was handed. Null renders nothing. */
  error: unknown;
  /** The heading when the throw was NOT an ApiError — i.e. a bug in this app, not an answer. */
  fallback?: string;
  /** Replaces the server's title. */
  heading?: string;
  /**
   * Replaces the server's explanation. Pass `false` to show NO explanation —
   * what the gate desk does with a 400, whose every message is already marked
   * on the field it is about.
   */
  detail?: React.ReactNode;
  /** An extra line under the explanation — what this screen knows that the server does not. */
  note?: React.ReactNode;
  /** Offer the same write again. The caller must reuse its idempotency key. */
  retry?: { onClick: () => void; label?: string; busy?: boolean };
  /**
   * One more way out, beside the retry — the screen's own: Sign in again on a
   * 401, Open the customer that already has this code, Reload after a 409.
   */
  action?: React.ReactNode;
  /** For a toolbar or a card header, where a full alert box would not fit. */
  compact?: boolean;
  tone?: 'error' | 'warning';
  className?: string;
  style?: React.CSSProperties;
}

/** The depot's set-up is missing, not a crash: the fix is a screen, not a retry. */
const NUMBER_SERIES_MISSING = 'NUMBER_SERIES_MISSING';

export function ErrorBanner({
  error, fallback, heading, detail, note, retry, action, compact, tone = 'error', className, style,
}: ErrorBannerProps) {
  const { can } = useSession();
  if (error === null || error === undefined) return null;

  const problem = problemOf(error, fallback ?? 'It could not be saved.');
  const setUp = problem.code === NUMBER_SERIES_MISSING;
  /* The banner already says to ask an administrator. The link is for the person
     who IS one, so they do not have to go looking for the screen. */
  const seriesLink = setUp && can('mdm.config.view');
  const body = detail ?? problem.explanation;

  return (
    <div role="alert" style={style}
      className={[
        compact ? 'gecko-error-note' : 'gecko-alert',
        compact ? `gecko-error-note-${tone}` : `gecko-alert-${tone}`,
        className,
      ].filter(Boolean).join(' ')}>
      <Icon name={setUp ? 'settings' : 'alertCircle'} size={compact ? 13 : 18} />
      <div className="gecko-error-banner-body">
        <div className="gecko-alert-title">{heading ?? problem.title}</div>
        {body && <div>{body}</div>}
        {note && <div className="gecko-error-banner-note">{note}</div>}
        {problem.reference && <Reference reference={problem.reference} />}
        {(seriesLink || retry || action) && (
          <div className="gecko-error-banner-actions">
            {seriesLink && (
              <Link href="/config/system-params?section=series" className="gecko-error-banner-link">
                Number series <Icon name="arrowRight" size={12} />
              </Link>
            )}
            {retry && (
              <button type="button" className="gecko-error-banner-link" disabled={retry.busy} onClick={retry.onClick}>
                {retry.busy ? 'Saving…' : retry.label ?? 'Save again'}
              </button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The id support needs, short enough to read down a phone and copyable in one
 * click. `user-select: all` is the fallback for a browser that refuses the
 * clipboard (an insecure origin): one click selects the whole id.
 */
function Reference({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(reference).then(() => setCopied(true)).catch(() => { /* the id is selectable anyway */ });
  };
  return (
    <div className="gecko-error-banner-ref">
      <span>Reference</span>
      {/* One string, not two children: React splits those with a comment node,
          and a clerk copying by hand would select the comment too. */}
      <span className="gecko-error-banner-ref-id" title={reference}>{`${reference.slice(0, 8)}…`}</span>
      <button type="button" className="gecko-error-banner-copy" onClick={copy}
        aria-label={copied ? 'Reference copied' : 'Copy the full reference'}>
        <Icon name={copied ? 'check' : 'copy'} size={12} /> {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
