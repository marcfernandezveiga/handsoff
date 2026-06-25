'use client';

import type { AgentEvent, AgentRole } from '@/lib/types';

interface Props {
  events: AgentEvent[];
}

const AGENTS: { role: AgentRole; name: string; tagline: string }[] = [
  { role: 'scout', name: 'Scout', tagline: 'Scans r/forhire for paid work' },
  { role: 'worker', name: 'Worker', tagline: 'Reads, assesses, and drafts deliverables' },
  { role: 'finance', name: 'Finance', tagline: 'Handles invoicing and payment collection' },
  { role: 'manager', name: 'Manager', tagline: 'Routes approvals and tracks the business' },
];

const ROLE_ICONS: Record<AgentRole, string> = {
  scout: 'S',
  worker: 'W',
  finance: 'F',
  manager: 'M',
};

function isAgentActive(role: AgentRole, events: AgentEvent[]): boolean {
  if (events.length === 0) return false;
  const cutoff = Date.now() - 30_000;
  return events.some(
    (e) => e.agent === role && new Date(e.created_at).getTime() > cutoff
  );
}

export function AgentRoster({ events }: Props) {
  return (
    <aside
      className="flex flex-col gap-3 p-4 w-56 shrink-0"
      style={{ borderRight: '1px solid var(--bg-border)' }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-widest px-1 mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        Agents
      </div>

      {AGENTS.map(({ role, name, tagline }) => {
        const active = isAgentActive(role, events);
        return (
          <div
            key={role}
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-xs font-bold"
              style={{
                background: 'var(--bg-border)',
                color: active ? 'var(--accent-green)' : 'var(--text-muted)',
              }}
            >
              {ROLE_ICONS[role]}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {name}
                </span>
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${active ? 'animate-pulse-dot' : ''}`}
                  style={{ background: active ? 'var(--accent-green)' : 'var(--text-muted)', opacity: active ? 1 : 0.4 }}
                />
              </div>
              <p
                className="text-xs leading-snug"
                style={{ color: 'var(--text-muted)' }}
              >
                {tagline}
              </p>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
