'use client';

import { useEffect, useState } from 'react';
import type { DashboardPayload, JobStatus } from '@/lib/types';
import { Header } from './Header';
import { ActivityFeed } from './ActivityFeed';
import { AuditFeed } from './AuditFeed';
import { JobsTable } from './JobsTable';
import { LearningsPanel } from './LearningsPanel';

interface Props {
  initial: DashboardPayload;
}

// Which tabs are shown in the filter strip
type TabFilter = 'all' | 'found' | 'charged' | 'skipped';

const TAB_CONFIG: { id: TabFilter; label: string; emoji: string; description: string }[] = [
  { id: 'all',     label: 'All',      emoji: '📋', description: 'Every company the agent looked at' },
  { id: 'found',   label: 'Detected', emoji: '🔍', description: 'Companies the agent found with upcoming deadlines' },
  { id: 'charged', label: 'Billed',   emoji: '💰', description: 'Companies that were sent a reminder and paid the fee' },
  { id: 'skipped', label: 'Skipped',  emoji: '⏭', description: 'Companies the agent decided to skip' },
];

export function Dashboard({ initial }: Props) {
  const [data, setData] = useState<DashboardPayload>(initial);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  // Poll the dashboard endpoint every 5s — read-only, no agent tick
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
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Derive the count for each tab so we can show it in the button
  const tabCounts: Record<TabFilter, number> = {
    all:     data.jobs.length,
    found:   data.jobs.filter((j) => j.status === 'found' || j.status === 'awaiting_approval' || j.status === 'approved').length,
    charged: data.jobs.filter((j) => j.status === 'charged').length,
    skipped: data.jobs.filter((j) => j.status === 'skipped').length,
  };

  // Filter jobs to pass to JobsTable based on active tab
  const filteredStatuses: JobStatus[] | null =
    activeTab === 'all'     ? null :
    activeTab === 'found'   ? ['found', 'awaiting_approval', 'approved'] :
    activeTab === 'charged' ? ['charged'] :
    activeTab === 'skipped' ? ['skipped'] :
    null;

  const filteredJobs = filteredStatuses
    ? data.jobs.filter((j) => filteredStatuses.includes(j.status))
    : data.jobs;

  const pendingCount = data.counts.awaiting;

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--ink-hi)' }}
    >
      <Header
        revenueCents={data.revenueCents}
        jobsDone={data.counts.charged}
      />

      {/* Tab filter strip */}
      <div
        className="flex shrink-0 items-center gap-1 px-4 py-2 animate-fade-in"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          animationDelay: '40ms',
        }}
      >
        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              className="tab-btn"
              title={tab.description}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.35rem 0.875rem',
                borderRadius: 'var(--radius-md)',
                border: isActive ? '1px solid var(--blue-border)' : '1px solid transparent',
                background: isActive ? 'var(--blue-dim)' : 'transparent',
                color: isActive ? 'var(--blue)' : 'var(--ink-lo)',
                fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>{tab.emoji}</span>
              {tab.label}
              <span
                className="font-mono tabular-nums"
                style={{
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-geist-mono)',
                  background: isActive ? 'var(--blue)' : 'var(--bg-raised)',
                  color: isActive ? '#fff' : 'var(--ink-lo)',
                  borderRadius: '99px',
                  padding: '0 0.4rem',
                  lineHeight: '1.4rem',
                  minWidth: '1.4rem',
                  textAlign: 'center',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}

        {pendingCount > 0 && (
          <span
            className="ml-auto text-xs font-semibold px-3 py-1 rounded-full animate-pulse-dot"
            style={{
              background: 'var(--amber-label)',
              color: 'var(--amber)',
              border: '1px solid var(--amber-border)',
            }}
          >
            {pendingCount} pending approval
          </span>
        )}
      </div>

      {/* Main 2-column layout */}
      <div
        className="flex flex-1 min-h-0"
        style={{ minHeight: 'calc(100vh - 116px)' }}
      >
        {/* Center: activity + companies */}
        <main className="flex flex-col flex-1 min-w-0 overflow-y-auto">
          <ActivityFeed events={data.events} />

          {/* Companies section */}
          <section className="animate-fade-up" style={{ animationDelay: '60ms' }}>
            <SectionLabel
              label="Companies"
              meta={`${filteredJobs.length} shown`}
            />
            <JobsTable jobs={filteredJobs} />
          </section>
        </main>

        {/* Right rail */}
        <aside
          className="w-80 shrink-0 flex flex-col overflow-y-auto"
          style={{ borderLeft: '1px solid var(--border)' }}
        >
          {/* Autonomous action log */}
          <div>
            <SectionLabel
              label="What the agent did"
              meta="autonomous"
            />
            <AuditFeed jobs={data.jobs} />
          </div>

          {/* Intelligence panel */}
          {data.learnings && (
            <div style={{ borderTop: '1px solid var(--border)' }}>
              <SectionLabel label="How it's learning" />
              <LearningsPanel learnings={data.learnings} />
            </div>
          )}
        </aside>
      </div>
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
      className="flex items-center justify-between px-5 py-3"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-sm font-semibold"
          style={{ color: 'var(--ink-hi)' }}
        >
          {label}
        </span>
        {badge !== undefined && badge > 0 && (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
            style={{
              background: warn ? 'var(--amber)' : 'var(--green)',
              color: '#fff',
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
