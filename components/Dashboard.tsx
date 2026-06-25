'use client';

import { useEffect, useRef, useState } from 'react';
import type { DashboardPayload } from '@/lib/types';
import { Header } from './Header';
import { ActivityFeed } from './ActivityFeed';
import { AuditFeed } from './AuditFeed';
import { JobsTable } from './JobsTable';
import { LearningsPanel } from './LearningsPanel';

interface Props {
  initial: DashboardPayload;
}

export function Dashboard({ initial }: Props) {
  const [data, setData] = useState<DashboardPayload>(initial);
  const [tickInFlight, setTickInFlight] = useState(false);
  const tickRef = useRef(false);

  // Poll the dashboard endpoint every 1500ms
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) return;
        const fresh: DashboardPayload = await res.json();
        setData(fresh);
      } catch {
        // Stay on current data if request fails
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, []);

  // Fire agent tick every 4 seconds, guarded against stacking
  useEffect(() => {
    const tickInterval = setInterval(async () => {
      if (tickRef.current) return;
      tickRef.current = true;
      setTickInFlight(true);
      try {
        await fetch('/api/agent/tick', { method: 'POST' });
      } finally {
        tickRef.current = false;
        setTickInFlight(false);
      }
    }, 4000);

    return () => clearInterval(tickInterval);
  }, []);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--ink-hi)' }}
    >
      <Header
        revenueCents={data.revenueCents}
        jobsDone={data.counts.charged}
        tickInFlight={tickInFlight}
      />

      {/* Pipeline stats strip */}
      <div
        className="flex shrink-0 animate-fade-in"
        style={{ borderBottom: '1px solid var(--border)', animationDelay: '40ms' }}
      >
        <PipelineStat label="Detected"  value={data.counts.found}    />
        <PipelineStat label="Billed"    value={data.counts.charged}  accent />
        <PipelineStat label="Skipped"   value={data.counts.skipped}  muted />
        {data.counts.awaiting > 0 && (
          <PipelineStat label="Pending"   value={data.counts.awaiting} warn />
        )}
      </div>

      {/* Main 2-column layout */}
      <div
        className="flex flex-1 min-h-0"
        style={{ minHeight: 'calc(100vh - 94px)' }}
      >
        {/* Center: activity + companies */}
        <main className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          <ActivityFeed events={data.events} />

          {/* Companies section */}
          <section className="animate-fade-up" style={{ animationDelay: '60ms' }}>
            <SectionLabel
              label="Companies"
              meta={`${data.jobs.length} total`}
            />
            <JobsTable jobs={data.jobs} />
          </section>
        </main>

        {/* Right rail */}
        <aside
          className="w-72 shrink-0 flex flex-col overflow-y-auto"
          style={{ borderLeft: '1px solid var(--border)' }}
        >
          {/* Autonomous action log */}
          <div>
            <SectionLabel
              label="Recent actions"
              meta="autonomous"
            />
            <AuditFeed jobs={data.jobs} />
          </div>

          {/* Intelligence panel */}
          {data.learnings && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <SectionLabel label="Intelligence" />
              <LearningsPanel learnings={data.learnings} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ─── PipelineStat ─────────────────────────────────────────────────────────── */

function PipelineStat({
  label,
  value,
  accent,
  warn,
  muted,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
  muted?: boolean;
}) {
  const color = accent
    ? 'var(--green)'
    : warn
      ? 'var(--amber)'
      : muted
        ? 'var(--ink-lo)'
        : 'var(--ink-md)';

  return (
    <div
      className="flex-1 flex flex-col gap-1 px-5 py-3"
      style={{ borderRight: '1px solid var(--border)' }}
    >
      <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
        {label}
      </span>
      <span
        className="font-mono text-xl font-bold tabular-nums leading-none stat-tick"
        style={{ color, fontFamily: 'var(--font-geist-mono)' }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─── SectionLabel ─────────────────────────────────────────────────────────── */

function SectionLabel({
  label,
  meta,
  badge,
  warn,
}: {
  label: string;
  meta?: string;
  badge?: number;
  warn?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-2.5"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold"
          style={{ color: 'var(--ink-md)' }}
        >
          {label}
        </span>
        {badge !== undefined && badge > 0 && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold animate-pulse-dot"
            style={{
              background: warn ? 'var(--amber)' : 'var(--green)',
              color: 'var(--bg-base)',
              fontSize: '10px',
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {meta && (
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
        >
          {meta}
        </span>
      )}
    </div>
  );
}
