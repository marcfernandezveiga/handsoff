'use client';

import { Fragment, useState } from 'react';
import type { Job, JobStatus } from '@/lib/types';

interface Props {
  jobs: Job[];
}

const STATUS_LABEL: Record<JobStatus, string> = {
  found:             'Found',
  skipped:           'Skipped',
  awaiting_approval: 'Waiting',
  approved:          'Sent',
  charged:           'Billed',
};

// Plain-language explanation of each status
const STATUS_EXPLAIN: Record<JobStatus, string> = {
  found:             'Agent spotted this company',
  skipped:           'Agent decided to skip',
  awaiting_approval: 'Reminder ready, needs approval',
  approved:          'Reminder sent to company',
  charged:           'Reminder sent, fee collected',
};

function statusColor(status: JobStatus): string {
  switch (status) {
    case 'charged':           return 'var(--green)';
    case 'approved':          return 'var(--green)';
    case 'awaiting_approval': return 'var(--amber)';
    case 'found':             return 'var(--blue)';
    case 'skipped':           return 'var(--ink-lo)';
  }
}

function statusBg(status: JobStatus): string {
  switch (status) {
    case 'charged':
    case 'approved':          return 'var(--green-label)';
    case 'awaiting_approval': return 'var(--amber-label)';
    case 'found':             return 'var(--blue-dim)';
    default:                  return 'var(--bg-raised)';
  }
}

function statusBorder(status: JobStatus): string {
  switch (status) {
    case 'charged':
    case 'approved':          return 'var(--green-border)';
    case 'awaiting_approval': return 'var(--amber-border)';
    case 'found':             return 'var(--blue-border)';
    default:                  return 'var(--border)';
  }
}

function formatFee(cents: number | null): string {
  if (cents === null) return '';
  return `£${(cents / 100).toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// Extract company name, stripping " -- accounts due ..." suffix
function companyName(title: string): string {
  const idx = title.indexOf(' --');
  return idx > -1 ? title.slice(0, idx) : title;
}

// Extract "accounts due DATE" portion
function duePart(title: string): string | null {
  const m = title.match(/accounts due (.+)/i);
  return m ? `Due ${m[1]}` : null;
}

export function JobsTable({ jobs }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--ink-md)' }}>
          No companies in this category yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-lo)' }}>
          The agent checks Companies House every few seconds
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {[
              { label: 'Company', width: 'auto' },
              { label: 'Status', width: '10rem' },
              { label: 'Penalty at risk', width: '9rem' },
              { label: 'Fee earned', width: '8rem' },
              { label: 'Age', width: '4.5rem' },
              { label: '', width: '6rem' }, // expand column
            ].map((col) => (
              <th
                key={col.label}
                className="px-5 py-3 text-left text-xs font-semibold"
                style={{
                  color: 'var(--ink-lo)',
                  width: col.width !== 'auto' ? col.width : undefined,
                  background: 'var(--bg-surface)',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((job) => {
            const isExpanded = expandedId === job.id;
            const company = companyName(job.title);
            const due = duePart(job.title);
            const hasReminder = Boolean(job.deliverable);

            return (
              <Fragment key={job.id}>
                <tr
                  className="table-row"
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: isExpanded ? 'var(--bg-hover)' : undefined,
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                >
                  {/* Company */}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="job-link font-semibold leading-snug line-clamp-1"
                        style={{ color: 'var(--ink-hi)', fontSize: '0.875rem' }}
                        title={job.title}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {company}
                      </a>
                      {due && (
                        <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
                          {due}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status badge */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                        style={{
                          background: statusBg(job.status),
                          color: statusColor(job.status),
                          border: `1px solid ${statusBorder(job.status)}`,
                        }}
                        title={STATUS_EXPLAIN[job.status]}
                      >
                        {STATUS_LABEL[job.status]}
                      </span>
                    </div>
                  </td>

                  {/* Penalty */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span
                      className="font-mono tabular-nums text-sm font-semibold"
                      style={{
                        color: job.budget_text && job.budget_text !== 'Risk: none'
                          ? 'var(--amber)'
                          : 'var(--ink-lo)',
                        fontFamily: 'var(--font-geist-mono)',
                      }}
                    >
                      {job.budget_text ?? '--'}
                    </span>
                  </td>

                  {/* Fee */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span
                      className="font-mono font-bold tabular-nums text-sm"
                      style={{
                        color: job.fee_cents ? 'var(--green)' : 'var(--ink-lo)',
                        fontFamily: 'var(--font-geist-mono)',
                      }}
                    >
                      {job.fee_cents ? formatFee(job.fee_cents) : '--'}
                    </span>
                  </td>

                  {/* Age */}
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span
                      className="font-mono tabular-nums text-xs"
                      style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
                    >
                      {timeAgo(job.created_at)}
                    </span>
                  </td>

                  {/* Expand affordance */}
                  <td className="px-5 py-3.5 whitespace-nowrap text-right">
                    {hasReminder && (
                      <button
                        className="text-xs font-medium flex items-center gap-1.5 ml-auto"
                        style={{
                          color: isExpanded ? 'var(--blue)' : 'var(--ink-md)',
                          background: isExpanded ? 'var(--blue-dim)' : 'var(--bg-raised)',
                          border: `1px solid ${isExpanded ? 'var(--blue-border)' : 'var(--border)'}`,
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.3rem 0.6rem',
                          cursor: 'pointer',
                          transition: 'all 120ms ease-out',
                          outline: 'none',
                          whiteSpace: 'nowrap',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : job.id);
                        }}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Hide reminder' : 'View reminder'}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 150ms ease-out',
                            fontSize: '0.55rem',
                          }}
                        >
                          ▶
                        </span>
                        {isExpanded ? 'Hide' : 'See email'}
                      </button>
                    )}
                  </td>
                </tr>

                {/* Expanded detail row */}
                {isExpanded && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <div
                        className="mx-5 my-3 rounded-lg p-4 expand-row"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {job.body && (
                          <p
                            className="text-sm leading-relaxed mb-3"
                            style={{ color: 'var(--ink-md)', maxWidth: '65ch' }}
                          >
                            {job.body}
                          </p>
                        )}
                        {job.reasoning && (
                          <div
                            className="mb-3 px-3 py-2.5 rounded-md text-xs"
                            style={{
                              background: 'var(--bg-raised)',
                              border: '1px solid var(--border)',
                              color: 'var(--ink-md)',
                            }}
                          >
                            <span className="font-semibold" style={{ color: 'var(--ink-hi)' }}>
                              Why the agent acted:{' '}
                            </span>
                            {job.reasoning}
                          </div>
                        )}
                        {job.deliverable && (
                          <div>
                            <p
                              className="text-xs font-semibold mb-2"
                              style={{ color: 'var(--ink-hi)' }}
                            >
                              Reminder email the agent wrote
                            </p>
                            <pre
                              className="text-xs leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto rounded-md p-4"
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
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
