'use client';

import { useState } from 'react';
import type { Job, JobStatus } from '@/lib/types';

interface Props {
  jobs: Job[];
}

const ACTION_LABEL: Record<JobStatus, string | null> = {
  charged:           'Billed',
  approved:          'Sent',
  skipped:           'Skipped',
  awaiting_approval: null, // should not appear in autonomous flow
  found:             null, // scouted, not yet processed
};

function formatFee(cents: number | null): string {
  if (!cents) return '';
  return `£${(cents / 100).toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Compact company name: strip "-- accounts due ..." suffix
function companyName(title: string): string {
  const idx = title.indexOf(' --');
  return idx > -1 ? title.slice(0, idx) : title;
}

function deadline(title: string): string | null {
  const m = title.match(/accounts due (.+)/i);
  return m ? m[1] : null;
}

export function AuditFeed({ jobs }: Props) {
  // Show charged / approved / skipped -- the agent has already acted on these
  const handled = [...jobs]
    .filter((j) => j.status === 'charged' || j.status === 'approved' || j.status === 'skipped')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  if (handled.length === 0) {
    return (
      <div
        className="mx-4 my-4 rounded-lg flex items-center justify-center h-16 text-xs"
        style={{
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          color: 'var(--ink-lo)',
        }}
      >
        No activity yet
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {handled.map((job, i) => (
        <AuditRow
          key={job.id}
          job={job}
          isLast={i === handled.length - 1}
        />
      ))}
    </div>
  );
}

function AuditRow({ job, isLast }: { job: Job; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [flagged, setFlagged] = useState(false);

  const action = ACTION_LABEL[job.status];
  const company = companyName(job.title);
  const due = deadline(job.title);

  const isBilled = job.status === 'charged';
  const isSkipped = job.status === 'skipped';

  return (
    <div
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}
    >
      {/* Main row */}
      <div
        className="flex items-start gap-3 px-4 py-3 event-row"
        style={{ cursor: job.deliverable ? 'pointer' : 'default' }}
        onClick={() => job.deliverable && setExpanded((v) => !v)}
      >
        {/* Status dot */}
        <div
          className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full"
          style={{
            background: isBilled
              ? 'var(--green)'
              : isSkipped
                ? 'var(--ink-lo)'
                : 'var(--ink-md)',
            opacity: isSkipped ? 0.4 : 1,
          }}
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span
              className="text-xs font-medium leading-snug"
              style={{
                color: isSkipped ? 'var(--ink-lo)' : 'var(--ink-hi)',
              }}
            >
              {company}
            </span>
            {job.fee_cents && (
              <span
                className="font-mono text-xs font-semibold shrink-0 tabular-nums"
                style={{ color: 'var(--green)', fontFamily: 'var(--font-geist-mono)' }}
              >
                {formatFee(job.fee_cents)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {action && (
              <span
                className="text-xs"
                style={{ color: isSkipped ? 'var(--ink-lo)' : 'var(--ink-lo)' }}
              >
                {action}
              </span>
            )}
            {due && !isSkipped && (
              <>
                <span style={{ color: 'var(--border)', fontSize: '0.55rem' }}>•</span>
                <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
                  due {due}
                </span>
              </>
            )}
            <span
              className="ml-auto font-mono text-xs"
              style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
            >
              {timeAgo(job.updated_at)}
            </span>
          </div>

          {/* Flag + expand affordances */}
          <div className="flex items-center gap-3 mt-1.5">
            {job.deliverable && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                className="text-xs"
                style={{
                  color: 'var(--ink-lo)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 150ms ease-out',
                    fontSize: '0.5rem',
                  }}
                >
                  ▶
                </span>
                {expanded ? 'Hide' : 'View reminder'}
              </button>
            )}

            {/* Subtle flag affordance -- non-blocking human oversight */}
            <button
              onClick={(e) => { e.stopPropagation(); setFlagged((v) => !v); }}
              title={flagged ? 'Unflag' : 'Flag for review'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: flagged ? 'var(--amber)' : 'var(--ink-lo)',
                opacity: flagged ? 1 : 0.35,
                transition: 'color 150ms ease-out, opacity 150ms ease-out',
                fontSize: '0.7rem',
                lineHeight: 1,
              }}
              aria-label={flagged ? 'Remove flag' : 'Flag for review'}
            >
              ⚑
            </button>
          </div>
        </div>
      </div>

      {/* Expanded reminder */}
      {expanded && job.deliverable && (
        <div
          className="mx-4 mb-3 expand-row"
        >
          <pre
            className="text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto rounded-md p-3"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              color: 'var(--ink-lo)',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
            }}
          >
            {job.deliverable}
          </pre>
        </div>
      )}
    </div>
  );
}
