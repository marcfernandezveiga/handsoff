'use client';

import { useRef } from 'react';
import type { AgentEvent, AgentRole } from '@/lib/types';

interface Props {
  events: AgentEvent[];
}

const ROLE_COLORS: Record<AgentRole, string> = {
  scout: '#3b82f6',
  worker: '#a855f7',
  finance: '#00e676',
  manager: '#f59e0b',
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
    <section className="flex flex-col min-h-0 flex-1">
      <div
        className="text-xs font-semibold uppercase tracking-widest px-5 py-3 shrink-0"
        style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--bg-border)' }}
      >
        Activity
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div
            className="flex items-center justify-center h-32 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            No activity yet
          </div>
        )}

        {sorted.map((event) => {
          const fresh = isNew(event.id);
          const color = ROLE_COLORS[event.agent];

          return (
            <div
              key={event.id}
              className={`flex gap-3 px-5 py-3 border-b ${fresh ? 'animate-slide-in' : ''}`}
              style={{ borderColor: 'var(--bg-border)' }}
            >
              <div
                className="w-1.5 rounded-full shrink-0 mt-1 self-start"
                style={{ background: color, height: '0.6rem', marginTop: '0.35rem' }}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-xs font-semibold capitalize"
                    style={{ color }}
                  >
                    {event.agent}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {event.action}
                  </span>
                </div>

                {event.detail && (
                  <p
                    className="text-xs leading-relaxed font-mono truncate"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}
                  >
                    {event.detail}
                  </p>
                )}
              </div>

              <span
                className="text-xs shrink-0 tabular-nums mt-0.5"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}
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
