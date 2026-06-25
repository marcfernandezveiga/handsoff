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
        className="flex flex-col items-center justify-center h-32 gap-2 mx-5 my-4 rounded-lg"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: 'var(--accent-green)' }}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Nothing waiting on you
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
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
  // 'idle' | the action currently in flight. Optimistically hides the card on success.
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
      // Roll back the optimistic hide so the human can retry
      setHidden(false);
      setBusy(null);
    }
  }

  if (hidden) return null;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-border)',
        borderLeft: '3px solid var(--accent-amber)',
      }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-2"
              style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--accent-amber)' }}
            >
              Awaiting approval
            </span>
            <h3
              className="text-sm font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {job.title}
            </h3>
          </div>
          <span
            className="text-sm font-bold shrink-0 font-mono"
            style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-geist-mono)' }}
          >
            {formatFee(job.fee_cents)}
          </span>
        </div>

        {job.reasoning && (
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            {job.reasoning}
          </p>
        )}

        {job.deliverable && (
          <div className="mb-3">
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Deliverable preview
            </div>
            <div
              className="text-xs leading-relaxed rounded-md p-3 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap"
              style={{
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                border: '1px solid var(--bg-border)',
                fontFamily: 'var(--font-geist-mono)',
              }}
            >
              {job.deliverable}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => run('approve')}
            disabled={busy !== null}
            className="approve-btn flex-1 py-2 px-4 rounded-md text-xs font-semibold cursor-pointer disabled:cursor-default disabled:opacity-60"
            style={{ background: 'var(--accent-green)', color: '#0a0a0f' }}
          >
            {busy === 'approve' ? 'Approving' : 'Approve and pay'}
          </button>
          <button
            onClick={() => run('reject')}
            disabled={busy !== null}
            className="reject-btn flex-1 py-2 px-4 rounded-md text-xs font-semibold cursor-pointer disabled:cursor-default disabled:opacity-60"
            style={{
              background: 'rgba(239,68,68,0.12)',
              color: 'var(--accent-red)',
              border: '1px solid rgba(239,68,68,0.3)',
            }}
          >
            {busy === 'reject' ? 'Rejecting' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
