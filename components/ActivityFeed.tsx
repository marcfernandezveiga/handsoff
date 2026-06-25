'use client';

import { useRef } from 'react';
import type { AgentEvent, AgentRole } from '@/lib/types';

interface Props {
  events: AgentEvent[];
}

// Plain-language role labels
const ROLE_LABEL: Record<AgentRole, string> = {
  scout:   'Scout',
  worker:  'Agent',
  finance: 'Finance',
  manager: 'Manager',
};

// Color per agent role -- so you can tell who did what at a glance
const ROLE_COLOR: Record<AgentRole, string> = {
  scout:   'var(--blue)',
  worker:  'var(--green)',
  finance: 'var(--amber)',
  manager: 'var(--ink-md)',
};

const ROLE_BG: Record<AgentRole, string> = {
  scout:   'var(--blue-dim)',
  worker:  'var(--green-dim)',
  finance: 'var(--amber-dim)',
  manager: 'var(--bg-raised)',
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function ActivityFeed({ events }: Props) {
  const seenRef = useRef<Set<string>>(new Set(events.map((e) => e.id)));

  function isNew(id: string): boolean {
    if (seenRef.current.has(id)) return false;
    seenRef.current.add(id);
    return true;
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <section className="flex flex-col min-h-0">
      {/* Section header */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--ink-hi)' }}>
          Live activity
        </span>
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
        >
          {sorted.length} events
        </span>
      </div>

      {/* Events list */}
      <div className="overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--ink-md)' }}>
              Waiting for Companies House activity
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-lo)' }}>
              The agent will check shortly
            </p>
          </div>
        )}

        {sorted.map((event) => {
          const fresh = isNew(event.id);

          return (
            <div
              key={event.id}
              className={`event-row flex items-start gap-3 px-5 py-3.5 ${fresh ? 'animate-slide-in' : ''}`}
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              {/* Agent role badge */}
              <span
                className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded mt-0.5"
                style={{
                  color: ROLE_COLOR[event.agent],
                  background: ROLE_BG[event.agent],
                  minWidth: '4rem',
                  textAlign: 'center',
                  fontFamily: 'var(--font-geist-sans)',
                }}
              >
                {ROLE_LABEL[event.agent]}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--ink-hi)' }}
                >
                  {event.action}
                </span>
                {event.detail && (
                  <p
                    className="mt-0.5 text-xs leading-relaxed"
                    style={{ color: 'var(--ink-md)' }}
                  >
                    {event.detail}
                  </p>
                )}
              </div>

              {/* Timestamp */}
              <span
                className="shrink-0 text-xs font-mono tabular-nums pt-0.5"
                style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)', whiteSpace: 'nowrap' }}
              >
                {timeAgo(event.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
