'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  revenueCents: number;
  jobsDone: number;
  tickInFlight: boolean;
}

export function Header({ revenueCents, jobsDone, tickInFlight }: Props) {
  const dollars = (revenueCents / 100).toFixed(2);

  // Pop the revenue number whenever it goes up
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
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--bg-border)',
      }}
      className="px-6 py-4 flex items-center gap-6"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <h1
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-geist-sans)' }}
          className="text-xl font-semibold tracking-tight whitespace-nowrap"
        >
          Hands Off
        </h1>

        <div className="flex items-center gap-1.5">
          <span
            className="animate-pulse-dot inline-block w-2 h-2 rounded-full"
            style={{ background: 'var(--accent-green)' }}
          />
          <span className="text-xs font-medium" style={{ color: 'var(--accent-green)' }}>
            Running
          </span>
        </div>

        {tickInFlight && (
          <div className="flex items-center gap-1.5 ml-2">
            <span
              className="animate-spin-slow inline-block w-3 h-3 border border-t-transparent rounded-full"
              style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              agents active
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <div
            className="text-xs font-medium uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Revenue
          </div>
          <div
            className={`font-mono text-4xl font-bold leading-none tabular-nums ${bumped ? 'revenue-bump' : ''}`}
            style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-geist-mono)' }}
          >
            ${dollars}
          </div>
        </div>

        <div className="text-right">
          <div
            className="text-xs font-medium uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            Jobs Done
          </div>
          <div
            className="font-mono text-3xl font-bold leading-none"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-geist-mono)' }}
          >
            {jobsDone}
          </div>
        </div>
      </div>
    </header>
  );
}
