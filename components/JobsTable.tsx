'use client';

import type { Job, JobStatus } from '@/lib/types';

interface Props {
  jobs: Job[];
}

const STATUS_STYLES: Record<JobStatus, { bg: string; color: string; label: string }> = {
  found: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'Found' },
  skipped: { bg: 'rgba(113,113,122,0.2)', color: '#71717a', label: 'Skipped' },
  awaiting_approval: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Awaiting' },
  approved: { bg: 'rgba(0,230,118,0.15)', color: '#00e676', label: 'Approved' },
  charged: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Charged' },
};

function formatFee(cents: number | null): string {
  if (cents === null) return '--';
  return `$${(cents / 100).toFixed(2)}`;
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

export function JobsTable({ jobs }: Props) {
  const sorted = [...jobs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-20 text-sm mx-5 my-4 rounded-lg"
        style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--bg-border)' }}
      >
        No jobs yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
            {['Job', 'Status', 'Budget', 'Fee', 'Found'].map((col) => (
              <th
                key={col}
                className="px-5 py-2.5 text-left font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((job) => {
            const style = STATUS_STYLES[job.status];
            return (
              <tr
                key={job.id}
                className="group"
                style={{ borderBottom: '1px solid var(--bg-border)' }}
              >
                <td className="px-5 py-3 max-w-xs">
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline cursor-pointer line-clamp-1"
                    style={{ color: 'var(--text-primary)' }}
                    title={job.title}
                  >
                    {job.title}
                  </a>
                  {job.reasoning && (
                    <p
                      className="mt-0.5 line-clamp-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {job.reasoning}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {style.label}
                  </span>
                </td>
                <td
                  className="px-5 py-3 whitespace-nowrap font-mono"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}
                >
                  {job.budget_text ?? '--'}
                </td>
                <td
                  className="px-5 py-3 whitespace-nowrap font-mono"
                  style={{ color: job.fee_cents ? 'var(--accent-green)' : 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}
                >
                  {formatFee(job.fee_cents)}
                </td>
                <td
                  className="px-5 py-3 whitespace-nowrap font-mono"
                  style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}
                >
                  {timeAgo(job.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
