'use client';

import { useRef } from 'react';
import type { AgentEvent, AgentRole } from '@/lib/types';

interface Props {
  events: AgentEvent[];
}

const ROLE_LABEL: Record<AgentRole, string> = {
  scout:   'Scout',
  worker:  'Worker',
  finance: 'Finance',
  manager: 'Manager',
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
        className="flex items-center justify-between px-5 py-2.5 shrink-0"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--ink-md)' }}>
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
          <div
            className="flex items-center justify-center h-24 text-xs"
            style={{ color: 'var(--ink-lo)' }}
          >
            Waiting for Companies House activity
          </div>
        )}

        {sorted.map((event) => {
          const fresh = isNew(event.id);

          return (
            <div
              key={event.id}
              className={`event-row flex items-start gap-4 px-5 py-3 ${fresh ? 'animate-slide-in' : ''}`}
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              {/* Agent role tag */}
              <span
                className="shrink-0 text-xs font-mono font-semibold tabular-nums mt-px"
                style={{
                  color: 'var(--ink-lo)',
                  minWidth: '3.5rem',
                  fontFamily: 'var(--font-geist-mono)',
                }}
              >
                {ROLE_LABEL[event.agent]}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--ink-hi)' }}
                >
                  {event.action}
                </span>
                {event.detail && (
                  <p
                    className="mt-0.5 text-xs leading-relaxed truncate"
                    style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
                  >
                    {event.detail}
                  </p>
                )}
              </div>

              {/* Timestamp */}
              <span
                className="shrink-0 text-xs font-mono tabular-nums pt-px"
                style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
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
