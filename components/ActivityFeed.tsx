'use client';

import { useRef } from 'react';
import type { AgentEvent, AgentRole } from '@/lib/types';

interface Props {
  events: AgentEvent[];
}

const ROLE_CONFIG: Record<AgentRole, { color: string; label: string }> = {
  scout:   { color: '#3b82f6', label: 'Scout'   },
  worker:  { color: '#a855f7', label: 'Worker'  },
  finance: { color: '#00e676', label: 'Finance' },
  manager: { color: '#f59e0b', label: 'Manager' },
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
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
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--bg-border)' }}
      >
        <span
          className="text-xs font-semibold uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
        >
          Live Activity
        </span>
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--text-muted)' }}
        >
          {sorted.length} event{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-y-auto">
        {sorted.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-2 h-28 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <span style={{ fontSize: 20, opacity: 0.3 }}>◌</span>
            <span className="text-xs">Waiting for Companies House activity</span>
          </div>
        )}

        {sorted.map((event) => {
          const fresh = isNew(event.id);
          const cfg = ROLE_CONFIG[event.agent];

          return (
            <div
              key={event.id}
              className={`flex items-start gap-3 px-5 py-3 border-b ${fresh ? 'animate-slide-in' : ''}`}
              style={{ borderColor: 'var(--bg-border)' }}
            >
              {/* Role color bar */}
              <div
                className="shrink-0 mt-1 rounded-full"
                style={{ width: 3, height: 28, background: cfg.color, opacity: 0.8 }}
              />

              <div className="min-w-0 flex-1">
                {/* Agent tag + action */}
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span
                    className="text-xs font-bold shrink-0"
                    style={{ color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                  <span
                    className="text-xs font-medium leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {event.action}
                  </span>
                </div>

                {event.detail && (
                  <p
                    className="text-xs leading-relaxed truncate"
                    style={{
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-geist-mono)',
                    }}
                  >
                    {event.detail}
                  </p>
                )}
              </div>

              <span
                className="text-xs shrink-0 tabular-nums pt-0.5"
                style={{
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-geist-mono)',
                  opacity: 0.7,
                }}
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
