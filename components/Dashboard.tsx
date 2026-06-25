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

        {/* Center: activity feed */}
        <main className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          <ActivityFeed events={data.events} />

          {/* Jobs table */}
          <section>
            <div
              className="text-xs font-semibold uppercase tracking-widest px-5 py-3"
              style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--bg-border)', borderTop: '1px solid var(--bg-border)' }}
            >
              Jobs
            </div>
            <JobsTable jobs={data.jobs} />
          </section>
        </main>

        {/* Right rail: approval queue + stat cards */}
        <aside
          className="w-80 shrink-0 flex flex-col overflow-y-auto"
          style={{ borderLeft: '1px solid var(--bg-border)' }}
        >
          {/* Stats strip */}
          <div
            className="grid grid-cols-2 gap-px"
            style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-border)' }}
          >
            {[
              { label: 'Found', value: data.counts.found, color: '#3b82f6' },
              { label: 'Awaiting', value: data.counts.awaiting, color: 'var(--accent-amber)' },
              { label: 'Charged', value: data.counts.charged, color: '#10b981' },
              { label: 'Skipped', value: data.counts.skipped, color: 'var(--text-muted)' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="px-4 py-3 flex flex-col gap-0.5"
                style={{ background: 'var(--bg-card)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </span>
                <span
                  className="text-xl font-bold font-mono leading-none"
                  style={{ color, fontFamily: 'var(--font-geist-mono)' }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Approval queue */}
          <div
            className="text-xs font-semibold uppercase tracking-widest px-5 py-3 flex items-center gap-2"
            style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--bg-border)' }}
          >
            Approvals
            {awaitingJobs.length > 0 && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
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
                className="text-xs font-semibold uppercase tracking-widest px-5 py-3"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--bg-border)', borderTop: '1px solid var(--bg-border)' }}
              >
                Agent intelligence
              </div>
              <LearningsPanel learnings={data.learnings} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
