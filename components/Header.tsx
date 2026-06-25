'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  revenueCents: number;
  jobsDone: number;
  tickInFlight: boolean;
}

export function Header({ revenueCents, jobsDone, tickInFlight }: Props) {
  const dollars = (revenueCents / 100).toFixed(2);

  const prevRevenue = useRef(revenueCents);
  const [bumped, setBumped] = useState(false);

  useEffect(() => {
    if (revenueCents > prevRevenue.current) {
      setBumped(true);
      const t = setTimeout(() => setBumped(false), 700);
      prevRevenue.current = revenueCents;
      return () => clearTimeout(t);
    }
    prevRevenue.current = revenueCents;
  }, [revenueCents]);

  return (
    <header
      style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--bg-border)',
      }}
      className="px-6 py-4 flex items-center gap-8 shrink-0"
    >
      {/* Brand + status */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col gap-0.5">
          <h1
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            className="text-lg font-semibold leading-none whitespace-nowrap"
          >
            Hands Off
          </h1>
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Companies House late-filing monitor
          </span>
        </div>

        <div className="h-8 w-px" style={{ background: 'var(--bg-border)' }} />

        {/* Live status */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span
              className="animate-pulse-ring absolute inset-0 rounded-full"
              style={{ background: 'var(--accent-green)', opacity: 0.4 }}
            />
            <span
              className="animate-pulse-dot relative inline-block w-2 h-2 rounded-full"
              style={{ background: 'var(--accent-green)' }}
            />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>
            Running
          </span>
        </div>

        {tickInFlight && (
          <div className="flex items-center gap-1.5">
            <span
              className="animate-spin-slow inline-block w-3 h-3 rounded-full"
              style={{
                border: '1.5px solid var(--text-muted)',
                borderTopColor: 'transparent',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              agents active
            </span>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Companies Billed - secondary metric */}
      <div className="text-right">
        <div
          className="text-xs font-medium uppercase tracking-widest mb-1"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
        >
          Companies Billed
        </div>
        <div
          className="font-mono text-2xl font-bold leading-none tabular-nums"
          style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-geist-mono)' }}
        >
          {jobsDone}
        </div>
      </div>

      <div className="h-10 w-px" style={{ background: 'var(--bg-border)' }} />

      {/* Revenue - hero metric */}
      <div className="text-right">
        <div
          className="text-xs font-semibold uppercase mb-1.5"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}
        >
          Revenue
        </div>
        <div
          className={`font-mono font-bold leading-none tabular-nums ${bumped ? 'revenue-bump' : ''}`}
          style={{
            color: 'var(--accent-green)',
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 'clamp(2rem, 4vw, 3.25rem)',
            letterSpacing: '-0.02em',
            textShadow: bumped ? '0 0 40px rgba(0, 230, 118, 0.5)' : undefined,
          }}
        >
          ${dollars}
        </div>
      </div>
    </header>
  );
}
