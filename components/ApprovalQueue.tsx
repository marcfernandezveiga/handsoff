'use client';

import { useState } from 'react';
import type { Job } from '@/lib/types';

interface Props {
  jobs: Job[];
  onUpdate: (id: string, status: 'approved' | 'rejected') => void;
}

function formatFee(cents: number | null): string {
  if (cents === null) return 'TBD';
  return `$${(cents / 100).toFixed(2)}`;
}

export function ApprovalQueue({ jobs, onUpdate }: Props) {
  const pending = jobs.filter((j) => j.status === 'awaiting_approval');

  if (pending.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-28 gap-2 mx-3 my-3 rounded-xl"
        style={{
          background: 'var(--accent-green-dim)',
          border: '1px solid rgba(0, 230, 118, 0.15)',
        }}
      >
        <span style={{ color: 'var(--accent-green)', fontSize: 18, opacity: 0.6 }}>✓</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          No companies awaiting review
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {pending.map((job) => (
        <ApprovalCard key={job.id} job={job} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

interface CardProps {
  job: Job;
  onUpdate: (id: string, status: 'approved' | 'rejected') => void;
}

function ApprovalCard({ job, onUpdate }: CardProps) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [hidden, setHidden] = useState(false);

  async function run(kind: 'approve' | 'reject') {
    if (busy) return;
    setBusy(kind);
    setHidden(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/${kind}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      onUpdate(job.id, kind === 'approve' ? 'approved' : 'rejected');
    } catch {
      setHidden(false);
      setBusy(null);
    }
  }

  if (hidden) return null;

  return (
    <div
      className="rounded-xl overflow-hidden animate-slide-in"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(245,158,11,0.25)',
        boxShadow: '0 0 0 1px rgba(245,158,11,0.08) inset',
      }}
    >
      {/* Amber top accent bar */}
      <div
        style={{
          height: 2,
          background: 'linear-gradient(90deg, var(--accent-amber), rgba(245,158,11,0.3))',
        }}
      />

      <div className="px-4 pt-3 pb-4">
        {/* Header: badge + fee */}
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--accent-amber-dim)',
              color: 'var(--accent-amber)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            Pending send
          </span>
          <span
            className="text-base font-bold font-mono shrink-0"
            style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-geist-mono)' }}
          >
            {formatFee(job.fee_cents)}
          </span>
        </div>

        {/* Title */}
        <h3
          className="text-sm font-semibold leading-snug mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {job.title}
        </h3>

        {/* Reasoning */}
        {job.reasoning && (
          <p
            className="text-xs mb-3 leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            {job.reasoning}
          </p>
        )}

        {/* Deliverable preview */}
        {job.deliverable && (
          <div className="mb-3">
            <div
              className="text-xs font-semibold uppercase mb-1.5"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              Reminder preview
            </div>
            <div
              className="text-xs leading-relaxed rounded-lg p-3 max-h-28 overflow-y-auto font-mono whitespace-pre-wrap"
              style={{
                background: 'var(--bg-base)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--bg-border)',
                fontFamily: 'var(--font-geist-mono)',
              }}
            >
              {job.deliverable}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => run('approve')}
            disabled={busy !== null}
            className="approve-btn flex-1 py-2.5 px-4 rounded-lg text-xs font-bold cursor-pointer disabled:cursor-default disabled:opacity-50"
            style={{ background: 'var(--accent-green)', color: '#0a0a0f' }}
          >
            {busy === 'approve' ? 'Sending...' : 'Send and bill'}
          </button>
          <button
            onClick={() => run('reject')}
            disabled={busy !== null}
            className="reject-btn flex-1 py-2.5 px-4 rounded-lg text-xs font-semibold cursor-pointer disabled:cursor-default disabled:opacity-50"
            style={{
              background: 'var(--accent-red-dim)',
              color: 'var(--accent-red)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            {busy === 'reject' ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
