'use client';

import { useState } from 'react';
import type { Job, JobStatus } from '@/lib/types';

interface Props {
  jobs: Job[];
}

const ACTION_LABEL: Record<JobStatus, string | null> = {
  charged:           'Sent reminder + billed',
  approved:          'Reminder sent',
  skipped:           'Skipped',
  awaiting_approval: null,
  found:             null,
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
      <div className="px-4 py-6 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--ink-md)' }}>
          No completed actions yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-lo)' }}>
          The agent will start acting soon
        </p>
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
  const hasReminder = Boolean(job.deliverable);

  return (
    <div
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}
    >
      {/* Main row */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 event-row"
        style={{ cursor: hasReminder ? 'pointer' : 'default' }}
        onClick={() => hasReminder && setExpanded((v) => !v)}
      >
        {/* Status dot */}
        <div
          className="mt-1.5 shrink-0 w-2 h-2 rounded-full"
          style={{
            background: isBilled
              ? 'var(--green)'
              : isSkipped
                ? 'var(--ink-lo)'
                : 'var(--blue)',
            opacity: isSkipped ? 0.4 : 1,
          }}
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span
              className="text-sm font-semibold leading-snug"
              style={{
                color: isSkipped ? 'var(--ink-lo)' : 'var(--ink-hi)',
              }}
            >
              {company}
            </span>
            {job.fee_cents && (
              <span
                className="font-mono text-sm font-bold shrink-0 tabular-nums"
                style={{ color: 'var(--green)', fontFamily: 'var(--font-geist-mono)' }}
              >
                {formatFee(job.fee_cents)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {action && (
              <span
                className="text-xs"
                style={{ color: isSkipped ? 'var(--ink-lo)' : 'var(--ink-md)' }}
              >
                {action}
              </span>
            )}
            {due && !isSkipped && (
              <>
                <span style={{ color: 'var(--border)', fontSize: '0.5rem' }}>•</span>
                <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
                  due {due}
                </span>
              </>
            )}
            <span
              className="ml-auto font-mono text-xs"
              style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)', whiteSpace: 'nowrap' }}
            >
              {timeAgo(job.updated_at)}
            </span>
          </div>

          {/* Expand + Flag affordances */}
          <div className="flex items-center gap-2 mt-2">
            {hasReminder && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded"
                style={{
                  color: expanded ? 'var(--blue)' : 'var(--ink-md)',
                  background: expanded ? 'var(--blue-dim)' : 'var(--bg-raised)',
                  border: `1px solid ${expanded ? 'var(--blue-border)' : 'var(--border)'}`,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 120ms ease-out',
                }}
                aria-expanded={expanded}
                aria-label={expanded ? 'Hide reminder' : 'View reminder email'}
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
                {expanded ? 'Hide email' : 'View reminder'}
              </button>
            )}

            {/* Flag affordance */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFlagged((v) => !v);
              }}
              title={flagged ? 'Remove flag' : 'Flag for review'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: flagged ? 'var(--amber)' : 'var(--ink-lo)',
                opacity: flagged ? 1 : 0.4,
                transition: 'color 120ms ease-out, opacity 120ms ease-out',
                fontSize: '0.8rem',
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
          <p
            className="text-xs font-semibold mb-1.5 px-1"
            style={{ color: 'var(--ink-hi)' }}
          >
            Reminder email the agent wrote:
          </p>
          <pre
            className="text-xs leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto rounded-lg p-4"
            style={{
              fontFamily: 'var(--font-geist-mono)',
              color: 'var(--ink-md)',
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
