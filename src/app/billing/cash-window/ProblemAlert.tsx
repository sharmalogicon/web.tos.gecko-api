"use client";
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { ApiError } from '@/lib/api/problem';

/** A failure as the server described it: its title is the heading, its detail the explanation. */
export interface Problem {
  title: string;
  detail: string | null;
}

/** The server's words when there are some; the fallback only when the API was not reached at all. */
export function problemOf(err: unknown, fallback: string): Problem {
  if (err instanceof ApiError) return { title: err.title, detail: err.explanation };
  return { title: fallback, detail: null };
}

export function ProblemAlert({ problem, style }: { problem: Problem; style?: React.CSSProperties }) {
  return (
    <div className="gecko-alert gecko-alert-error" role="alert" style={style}>
      <Icon name="alertCircle" size={18} />
      <div>
        <strong>{problem.title}</strong>
        {problem.detail && <div>{problem.detail}</div>}
      </div>
    </div>
  );
}
