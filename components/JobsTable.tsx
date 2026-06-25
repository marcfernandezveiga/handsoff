'use client';

import { Fragment, useState } from 'react';
import type { Job, JobStatus } from '@/lib/types';

interface Props {
  jobs: Job[];
}

const STATUS_LABEL: Record<JobStatus, string> = {
  found:             'Found',
  skipped:           'Skipped',
  awaiting_approval: 'Awaiting',
  approved:          'Sent',
  charged:           'Billed',
};

function statusColor(status: JobStatus): string {
  switch (status) {
    case 'charged':           return 'var(--green)';
    case 'approved':          return 'var(--green)';
    case 'awaiting_approval': return 'var(--amber)';
    case 'found':             return 'var(--ink-md)';
    case 'skipped':           return 'var(--ink-lo)';
  }
}

function statusBg(status: JobStatus): string {
  switch (status) {
    case 'charged':
    case 'approved':          return 'var(--green-dim)';
    case 'awaiting_approval': return 'var(--amber-dim)';
    default:                  return 'var(--bg-raised)';
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

export function JobsTable({ jobs }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-16 mx-5 my-4 rounded-lg text-xs"
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--ink-lo)',
          border: '1px solid var(--border)',
        }}
      >
        No companies detected yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Company', 'Status', 'Penalty risk', 'Fee', 'Age'].map((col) => (
              <th
                key={col}
                className="px-5 py-2.5 text-left font-medium"
                style={{ color: 'var(--ink-lo)' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((job) => {
            const isExpanded = expandedId === job.id;

            return (
              <Fragment key={job.id}>
                <tr
                  className="table-row"
                  style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)' }}
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                >
                  {/* Company */}
                  <td className="px-5 py-3 max-w-xs">
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="job-link font-medium leading-snug line-clamp-1"
                      style={{ color: 'var(--ink-hi)' }}
                      title={job.title}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {job.title}
                    </a>
                  </td>

                  {/* Status badge */}
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        background: statusBg(job.status),
                        color: statusColor(job.status),
                      }}
                    >
                      {STATUS_LABEL[job.status]}
                    </span>
                  </td>

                  {/* Penalty */}
                  <td
                    className="px-5 py-3 whitespace-nowrap font-mono tabular-nums"
                    style={{
                      color: job.budget_text?.includes('£150') || job.budget_text?.includes('£375')
                        ? 'var(--amber)'
                        : 'var(--ink-lo)',
                      fontFamily: 'var(--font-geist-mono)',
                    }}
                  >
                    {job.budget_text ?? '--'}
                  </td>

                  {/* Fee */}
                  <td
                    className="px-5 py-3 whitespace-nowrap font-mono font-semibold tabular-nums"
                    style={{
                      color: job.fee_cents ? 'var(--green)' : 'var(--ink-lo)',
                      fontFamily: 'var(--font-geist-mono)',
                    }}
                  >
                    {job.fee_cents ? formatFee(job.fee_cents) : '--'}
                  </td>

                  {/* Age */}
                  <td
                    className="px-5 py-3 whitespace-nowrap font-mono tabular-nums"
                    style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
                  >
                    {timeAgo(job.created_at)}
                  </td>
                </tr>

                {/* Expanded detail row */}
                {isExpanded && (
                  <tr
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <td
                      colSpan={5}
                      className="px-5 pb-4 pt-0"
                    >
                      <div
                        className="rounded-lg p-4 expand-row"
                        style={{
                          background: 'var(--bg-raised)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {job.body && (
                          <p
                            className="text-xs leading-relaxed mb-3"
                            style={{ color: 'var(--ink-md)' }}
                          >
                            {job.body}
                          </p>
                        )}
                        {job.reasoning && (
                          <p
                            className="text-xs leading-relaxed mb-3"
                            style={{ color: 'var(--ink-lo)' }}
                          >
                            <span style={{ color: 'var(--ink-md)' }}>Reasoning: </span>
                            {job.reasoning}
                          </p>
                        )}
                        {job.deliverable && (
                          <div>
                            <p
                              className="text-xs font-semibold mb-1.5"
                              style={{ color: 'var(--ink-md)' }}
                            >
                              Drafted reminder
                            </p>
                            <pre
                              className="text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto rounded-md p-3"
                              style={{
                                fontFamily: 'var(--font-geist-mono)',
                                color: 'var(--ink-lo)',
                                background: 'var(--bg-base)',
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
