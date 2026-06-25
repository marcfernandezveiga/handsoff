'use client';

import type { AgentEvent, AgentRole } from '@/lib/types';

interface Props {
  events: AgentEvent[];
}

const AGENTS: { role: AgentRole; name: string; tagline: string }[] = [
  { role: 'scout',   name: 'Scout',   tagline: 'Monitors Companies House' },
  { role: 'worker',  name: 'Worker',  tagline: 'Drafts reminder and checklist' },
  { role: 'finance', name: 'Finance', tagline: 'Bills the service fee' },
  { role: 'manager', name: 'Manager', tagline: 'Oversees the pipeline' },
];

const ROLE_CONFIG: Record<AgentRole, { color: string; bg: string; icon: string }> = {
  scout:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: '◈' },
  worker:  { color: '#a855f7', bg: 'rgba(168,85,247,0.12)', icon: '⬡' },
  finance: { color: '#00e676', bg: 'rgba(0,230,118,0.12)',  icon: '$' },
  manager: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⬛' },
};

function isAgentActive(role: AgentRole, events: AgentEvent[]): boolean {
  if (events.length === 0) return false;
  const cutoff = Date.now() - 30_000;
  return events.some(
    (e) => e.agent === role && new Date(e.created_at).getTime() > cutoff
  );
}

function getLastAction(role: AgentRole, events: AgentEvent[]): string | null {
  const latest = [...events]
    .filter((e) => e.agent === role)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  return latest?.action ?? null;
}

export function AgentRoster({ events }: Props) {
  return (
    <aside
      className="flex flex-col gap-2 p-3 w-52 shrink-0"
      style={{ borderRight: '1px solid var(--bg-border)' }}
    >
      <div
        className="text-xs font-semibold uppercase px-1 pt-1 pb-2"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
      >
        Agents
      </div>

      {AGENTS.map(({ role, name, tagline }, i) => {
        const active = isAgentActive(role, events);
        const lastAction = getLastAction(role, events);
        const cfg = ROLE_CONFIG[role];

        return (
          <div
            key={role}
            className="agent-card flex items-start gap-2.5 p-3 rounded-lg animate-fade-up"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-card)',
              animationDelay: `${i * 50}ms`,
            }}
          >
            {/* Icon badge */}
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-sm font-bold"
              style={{
                background: active ? cfg.bg : 'var(--bg-border)',
                color: active ? cfg.color : 'var(--text-muted)',
                transition: 'background var(--transition-base), color var(--transition-base)',
              }}
            >
              {cfg.icon}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className="text-xs font-semibold"
                  style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  {name}
                </span>

                {/* Status dot with ring when active */}
                <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
                  {active && (
                    <span
                      className="animate-pulse-ring absolute inset-0 rounded-full"
                      style={{ background: cfg.color, opacity: 0.35 }}
                    />
                  )}
                  <span
                    className={`relative inline-block w-1.5 h-1.5 rounded-full ${active ? 'animate-pulse-dot' : ''}`}
                    style={{
                      background: active ? cfg.color : 'var(--text-muted)',
                      opacity: active ? 1 : 0.35,
                      transition: 'background var(--transition-base)',
                    }}
                  />
                </div>
              </div>

              <p
                className="text-xs leading-snug truncate"
                style={{ color: active && lastAction ? cfg.color : 'var(--text-muted)', opacity: 0.9 }}
              >
                {active && lastAction ? lastAction : tagline}
              </p>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
