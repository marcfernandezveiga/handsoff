'use client';

import { useEffect, useRef, useState } from 'react';
import type { DashboardPayload, Job } from '@/lib/types';
import { Header } from './Header';
import { AgentRoster } from './AgentRoster';
import { ActivityFeed } from './ActivityFeed';
import { ApprovalQueue } from './ApprovalQueue';
import { JobsTable } from './JobsTable';
import { LearningsPanel } from './LearningsPanel';

interface Props {
  initial: DashboardPayload;
}

const STAT_CONFIGS = [
  { label: 'Detected',  key: 'found'    as const, color: 'var(--accent-blue)'  },
  { label: 'Pending',   key: 'awaiting' as const, color: 'var(--accent-amber)' },
  { label: 'Billed',    key: 'charged'  as const, color: 'var(--accent-green)' },
  { label: 'Skipped',   key: 'skipped'  as const, color: 'var(--text-muted)'   },
];

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

  // Optimistic update when a job is approved or rejected in the approval queue
  function handleApprovalUpdate(id: string, status: 'approved' | 'rejected') {
    setData((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j): Job =>
        j.id === id ? { ...j, status: status === 'approved' ? 'approved' : 'skipped' } : j
      ),
    }));
  }

  const awaitingJobs = data.jobs.filter((j) => j.status === 'awaiting_approval');

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <Header
        revenueCents={data.revenueCents}
        jobsDone={data.counts.charged}
        tickInFlight={tickInFlight}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ minHeight: 'calc(100vh - 73px)' }}>
        {/* Left rail: agent roster */}
        <AgentRoster events={data.events} />

        {/* Center: activity feed + jobs table */}
        <main className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          <ActivityFeed events={data.events} />

          {/* Jobs section */}
          <section className="animate-fade-up" style={{ animationDelay: '80ms' }}>
            <div
              className="flex items-center justify-between px-5 py-2.5"
              style={{
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--bg-border)',
                borderTop: '1px solid var(--bg-border)',
              }}
            >
              <span
                className="text-xs font-semibold uppercase"
                style={{ letterSpacing: '0.1em' }}
              >
                Companies
              </span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                {data.jobs.length} total
              </span>
            </div>
            <JobsTable jobs={data.jobs} />
          </section>
        </main>

        {/* Right rail: stats + approvals + learnings */}
        <aside
          className="w-80 shrink-0 flex flex-col overflow-y-auto"
          style={{ borderLeft: '1px solid var(--bg-border)' }}
        >
          {/* Stats strip */}
          <div
            className="grid grid-cols-2 gap-px animate-fade-in"
            style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-border)' }}
          >
            {STAT_CONFIGS.map(({ label, key, color }) => (
              <div
                key={label}
                className="px-4 py-3.5 flex flex-col gap-1"
                style={{ background: 'var(--bg-card)' }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </span>
                <span
                  className="text-2xl font-bold font-mono leading-none tabular-nums"
                  style={{ color, fontFamily: 'var(--font-geist-mono)' }}
                >
                  {data.counts[key]}
                </span>
              </div>
            ))}
          </div>

          {/* Approvals section header */}
          <div
            className="flex items-center gap-2 px-4 py-2.5"
            style={{
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--bg-border)',
            }}
          >
            <span
              className="text-xs font-semibold uppercase"
              style={{ letterSpacing: '0.1em' }}
            >
              Approvals
            </span>
            {awaitingJobs.length > 0 && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold animate-pulse-dot"
                style={{ background: 'var(--accent-amber)', color: '#0a0a0f' }}
              >
                {awaitingJobs.length}
              </span>
            )}
          </div>

          <ApprovalQueue jobs={data.jobs} onUpdate={handleApprovalUpdate} />

          {/* Learning panel */}
          {data.learnings && (
            <>
              <div
                className="flex items-center gap-2 px-4 py-2.5"
                style={{
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--bg-border)',
                  borderTop: '1px solid var(--bg-border)',
                }}
              >
                <span
                  className="text-xs font-semibold uppercase"
                  style={{ color: '#7c3aed', letterSpacing: '0.1em' }}
                >
                  Agent intelligence
                </span>
                <span
                  className="animate-pulse-dot inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: '#7c3aed' }}
                />
              </div>
              <LearningsPanel learnings={data.learnings} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
