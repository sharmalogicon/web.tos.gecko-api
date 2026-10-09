"use client";

/**
 * A receipt by its NUMBER rather than its id.
 *
 * Receipts refer to each other by number — a split names its parts, a part
 * names the original, a replacement names what it replaced — because the number
 * is what is printed and what a customer quotes on the phone. The detail page
 * is keyed by id, so this resolves one to the other and steps out of the way.
 *
 * Bound to GET /api/revenue/cash-bills/receipts/by-no/{receiptNo}.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api/problem';
import { receiptByNo } from '@/lib/api/cash-bills';

export default function ReceiptByNoPage() {
  const params = useParams<{ no: string }>();
  const router = useRouter();
  const no = (() => { try { return decodeURIComponent(params.no); } catch { return params.no; } })();
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!no) return;
    let alive = true;
    void receiptByNo(no)
      // `replace`, not `push`: the number was a redirect, and Back should go to
      // wherever the clerk came from rather than bouncing through it again.
      .then(r => { if (alive) router.replace(`/billing/receipts/${encodeURIComponent(r.receiptId)}`); })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e : new ApiError(0, 'That receipt could not be read.'));
      });
    return () => { alive = false; };
  }, [no, router]);

  if (!error) {
    return <div className="gecko-cell-meta gecko-page-loading">Opening <span className="gecko-mono">{no}</span>…</div>;
  }

  return (
    <div className="gecko-stack gecko-stack-xl gecko-page-loading">
      <div role="alert" className="gecko-alert gecko-alert-error">
        <Icon name="alertCircle" size={18} />
        <div>
          <strong>{error.status === 404 ? 'No such receipt' : error.title}</strong>
          <div>
            {error.status === 404
              ? <>Nothing in this depot is numbered <span className="gecko-mono">{no}</span>. It may belong to another branch.</>
              : error.explanation ?? error.message}
          </div>
        </div>
      </div>
      <div>
        <Link href="/billing/statement" className="gecko-btn gecko-btn-outline gecko-btn-sm">
          <Icon name="arrowLeft" size={13} /> Back to Billing
        </Link>
      </div>
    </div>
  );
}
