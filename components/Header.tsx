'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  revenueCents: number;
  jobsDone: number;
  tickInFlight: boolean;
}

function formatRevenue(cents: number): string {
  const pounds = (cents / 100).toFixed(2);
  return `£${pounds}`;
}

export function Header({ revenueCents, jobsDone, tickInFlight }: Props) {
  const prevRevenue = useRef(revenueCents);
  const [bumped, setBumped] = useState(false);

  useEffect(() => {
    if (revenueCents > prevRevenue.current) {
      setBumped(true);
      const t = setTimeout(() => setBumped(false), 600);
      prevRevenue.current = revenueCents;
      return () => clearTimeout(t);
    }
    prevRevenue.current = revenueCents;
  }, [revenueCents]);

  return (
    <header
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}
      className="px-6 h-14 flex items-center gap-6 shrink-0"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Live indicator */}
        <div className="relative flex items-center justify-center w-3 h-3">
          <span
            className="animate-pulse-ring absolute inset-0 rounded-full"
            style={{ background: 'var(--green)', opacity: 0.3 }}
          />
          <span
            className="animate-pulse-dot relative inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--green)' }}
          />
        </div>

        <span
          style={{ color: 'var(--ink-hi)', letterSpacing: '-0.02em' }}
          className="text-sm font-semibold leading-none"
        >
          Hands Off
        </span>

        <span
          className="text-xs px-1.5 py-0.5 rounded font-medium"
          style={{
            background: 'var(--green-dim)',
            color: 'var(--green)',
            border: '1px solid var(--green-border)',
          }}
        >
          running
        </span>

        {tickInFlight && (
          <div className="flex items-center gap-1.5 ml-1">
            <span
              className="animate-spin-slow inline-block w-2.5 h-2.5 rounded-full"
              style={{
                border: '1.5px solid var(--border)',
                borderTopColor: 'var(--ink-lo)',
              }}
            />
            <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
              processing
            </span>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Billed count -- secondary */}
      <div
        className="flex items-center gap-2.5"
        style={{ borderRight: '1px solid var(--border)', paddingRight: '1.5rem' }}
      >
        <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
          Companies billed
        </span>
        <span
          className="font-mono text-sm font-semibold tabular-nums"
          style={{ color: 'var(--ink-md)', fontFamily: 'var(--font-geist-mono)' }}
        >
          {jobsDone}
        </span>
      </div>

      {/* Revenue -- the headline */}
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
          Revenue
        </span>
        <span
          className={`font-mono font-bold tabular-nums leading-none ${bumped ? 'revenue-bump' : ''}`}
          style={{
            color: 'var(--green)',
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 'clamp(1.25rem, 2vw, 1.75rem)',
            letterSpacing: '-0.03em',
          }}
        >
          {formatRevenue(revenueCents)}
        </span>
      </div>
    </header>
  );
}
