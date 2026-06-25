'use client';

import { useOptimistic, useTransition, useEffect, useState } from 'react';
import type { DashboardPayload, JobStatus } from '@/lib/types';
import { Header } from './Header';
import { ActivityFeed } from './ActivityFeed';
import { AuditFeed } from './AuditFeed';
import { JobsTable } from './JobsTable';
import { LearningsPanel } from './LearningsPanel';

interface Props {
  initial: DashboardPayload;
}

type SidebarView = 'activity' | 'companies';
type CompanyFilter = 'all' | 'found' | 'charged' | 'skipped';

const COMPANY_FILTER_OPTIONS: { id: CompanyFilter; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'found',   label: 'Detected' },
  { id: 'charged', label: 'Billed' },
  { id: 'skipped', label: 'Skipped' },
];

/* ─── Inline SVG icons ─────────────────────────────────────────────────────── */

function ActivityIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function BuildingIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

/* ─── Dashboard ────────────────────────────────────────────────────────────── */

export function Dashboard({ initial }: Props) {
  const [data, setData] = useState<DashboardPayload>(initial);
  const [activeView, setActiveView] = useState<SidebarView>('activity');
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  const [isPending, startTransition] = useTransition();

  // Optimistic paused state — flips instantly on click, syncs from poll
  const [optimisticPaused, setOptimisticPaused] = useOptimistic(data.paused);

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

  function handleTogglePause() {
    const next = !optimisticPaused;
    startTransition(async () => {
      setOptimisticPaused(next);
      try {
        const res = await fetch('/api/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paused: next }),
        });
        if (res.ok) {
          const { paused } = await res.json() as { paused: boolean };
          setData((prev) => ({ ...prev, paused }));
        }
      } catch {
        // Poll will reconcile on its next tick
      }
    });
  }

  const paused = optimisticPaused;

  // Derive counts for the companies filter dropdown
  const companyCounts: Record<CompanyFilter, number> = {
    all:     data.jobs.length,
    found:   data.jobs.filter((j) => j.status === 'found' || j.status === 'awaiting_approval' || j.status === 'approved').length,
    charged: data.jobs.filter((j) => j.status === 'charged').length,
    skipped: data.jobs.filter((j) => j.status === 'skipped').length,
  };

  // Filter jobs for the Companies view
  const filteredStatuses: JobStatus[] | null =
    companyFilter === 'all'     ? null :
    companyFilter === 'found'   ? ['found', 'awaiting_approval', 'approved'] :
    companyFilter === 'charged' ? ['charged'] :
    companyFilter === 'skipped' ? ['skipped'] :
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
        earnedCents={data.earnedCents}
        invoicedCents={data.invoicedCents}
        jobsDone={data.counts.charged}
        paused={paused}
        onTogglePause={handleTogglePause}
      />

      {/* Paused banner */}
      {paused && (
        <div
          className="animate-fade-in"
          role="status"
          aria-live="polite"
          style={{
            background: 'var(--amber-dim)',
            borderBottom: '1px solid var(--amber-border)',
            padding: '0.5rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '1rem' }}>⏸</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--amber)' }}>
            Agent is paused.
          </span>
          <span className="text-sm" style={{ color: 'var(--ink-md)' }}>
            The autonomous loop is stopped and will not process new companies until you resume it.
          </span>
          {isPending && (
            <span className="ml-auto text-xs" style={{ color: 'var(--ink-lo)' }}>
              Updating...
            </span>
          )}
        </div>
      )}

      {/* Body: sidebar + main */}
      <div className="flex flex-1 min-h-0" style={{ minHeight: 'calc(100vh - 64px)' }}>

        {/* Left sidebar */}
        <nav
          className="flex flex-col shrink-0"
          style={{
            width: '13rem',
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            padding: '0.75rem 0.5rem',
            gap: '0.25rem',
          }}
          aria-label="Dashboard navigation"
        >
          <SidebarItem
            id="activity"
            label="Activity"
            icon={<ActivityIcon />}
            active={activeView === 'activity'}
            onClick={() => setActiveView('activity')}
          />
          <SidebarItem
            id="companies"
            label="Companies"
            icon={<BuildingIcon />}
            active={activeView === 'companies'}
            onClick={() => setActiveView('companies')}
            badge={pendingCount > 0 ? pendingCount : undefined}
          />
        </nav>

        {/* Main content area */}
        {activeView === 'activity' ? (
          /* ── Activity view: feed + right rail ── */
          <div className="flex flex-1 min-w-0 min-h-0">
            <main className="flex flex-col flex-1 min-w-0 overflow-y-auto">
              <ActivityFeed events={data.events} />
            </main>

            {/* Right rail: audit log + learnings */}
            <aside
              className="w-80 shrink-0 flex flex-col overflow-y-auto"
              style={{ borderLeft: '1px solid var(--border)' }}
            >
              <div>
                <SectionLabel label="What the agent did" meta="autonomous" />
                <AuditFeed jobs={data.jobs} />
              </div>

              {data.learnings && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <SectionLabel label="How it's learning" />
                  <LearningsPanel learnings={data.learnings} />
                </div>
              )}
            </aside>
          </div>
        ) : (
          /* ── Companies view: filter bar + table ── */
          <main className="flex flex-col flex-1 min-w-0 overflow-y-auto">
            {/* Filter bar */}
            <div
              className="flex items-center gap-3 px-5 py-3 shrink-0"
              style={{
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-surface)',
              }}
            >
              <label
                htmlFor="company-filter"
                className="text-xs font-semibold"
                style={{ color: 'var(--ink-lo)', whiteSpace: 'nowrap' }}
              >
                Show
              </label>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <select
                  id="company-filter"
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value as CompanyFilter)}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--ink-hi)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    padding: '0.35rem 2rem 0.35rem 0.75rem',
                    cursor: 'pointer',
                    outline: 'none',
                    fontFamily: 'var(--font-geist-sans)',
                  }}
                >
                  {COMPANY_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} ({companyCounts[opt.id]})
                    </option>
                  ))}
                </select>
                {/* Chevron icon */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    pointerEvents: 'none',
                    color: 'var(--ink-lo)',
                  }}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              <span
                className="text-xs font-mono"
                style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
              >
                {filteredJobs.length} shown
              </span>

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

            <JobsTable jobs={filteredJobs} />
          </main>
        )}
      </div>
    </div>
  );
}

/* ─── SidebarItem ──────────────────────────────────────────────────────────── */

interface SidebarItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

function SidebarItem({ label, icon, active, onClick, badge }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className="sidebar-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        width: '100%',
        padding: '0.5rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        border: active ? '1px solid var(--blue-border)' : '1px solid transparent',
        background: active ? 'var(--blue-dim)' : 'transparent',
        color: active ? 'var(--blue)' : 'var(--ink-md)',
        fontSize: '0.875rem',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        outline: 'none',
        textAlign: 'left',
        transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
      }}
      aria-current={active ? 'page' : undefined}
    >
      <span style={{ display: 'flex', flexShrink: 0, opacity: active ? 1 : 0.65 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && (
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: '0.7rem',
            fontFamily: 'var(--font-geist-mono)',
            background: active ? 'var(--blue)' : 'var(--amber)',
            color: '#fff',
            borderRadius: '99px',
            padding: '0 0.4rem',
            lineHeight: '1.4rem',
            minWidth: '1.4rem',
            textAlign: 'center',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ─── SectionLabel ─────────────────────────────────────────────────────────── */

function SectionLabel({ label, meta }: { label: string; meta?: string }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}
    >
      <span className="text-sm font-semibold" style={{ color: 'var(--ink-hi)' }}>
        {label}
      </span>
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
