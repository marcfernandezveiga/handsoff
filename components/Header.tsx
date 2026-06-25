'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  revenueCents: number;
  jobsDone: number;
}

function formatRevenue(cents: number): string {
  const pounds = (cents / 100).toFixed(2);
  return `£${pounds}`;
}

export function Header({ revenueCents, jobsDone }: Props) {
  const prevRevenue = useRef(revenueCents);
  const [bumped, setBumped] = useState(false);

  useEffect(() => {
    if (revenueCents > prevRevenue.current) {
      setBumped(true);
      const t = setTimeout(() => setBumped(false), 500);
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
        boxShadow: '0 1px 3px oklch(0.18 0.012 252 / 0.06)',
      }}
      className="px-6 h-16 flex items-center gap-5 shrink-0"
    >
      {/* Brand */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Live indicator */}
        <div className="relative flex items-center justify-center w-4 h-4">
          <span
            className="animate-pulse-ring absolute inset-0 rounded-full"
            style={{ background: 'var(--green)', opacity: 0.35 }}
          />
          <span
            className="animate-pulse-dot relative inline-block w-2 h-2 rounded-full"
            style={{ background: 'var(--green)' }}
          />
        </div>

        <div className="flex flex-col leading-none gap-0.5">
          <span
            style={{ color: 'var(--ink-hi)', letterSpacing: '-0.02em', fontSize: '1rem', fontWeight: 700 }}
          >
            Hands Off
          </span>
          <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
            AI agent running on its own
          </span>
        </div>

        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{
            background: 'var(--green-label)',
            color: 'var(--green)',
            border: '1px solid var(--green-border)',
          }}
        >
          live
        </span>


      </div>

      <div className="flex-1" />

      {/* Companies billed -- secondary */}
      <div
        className="flex flex-col items-end gap-0.5"
        style={{ borderRight: '1px solid var(--border)', paddingRight: '1.5rem' }}
      >
        <span
          className="font-mono font-bold tabular-nums leading-none"
          style={{
            color: 'var(--ink-hi)',
            fontSize: '1.25rem',
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-geist-mono)',
          }}
        >
          {jobsDone}
        </span>
        <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
          companies billed
        </span>
      </div>

      {/* Revenue -- the headline */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span
          className={`font-mono font-bold tabular-nums leading-none ${bumped ? 'revenue-bump' : ''}`}
          style={{
            color: 'var(--green)',
            fontFamily: 'var(--font-geist-mono)',
            fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
            letterSpacing: '-0.03em',
          }}
        >
          {formatRevenue(revenueCents)}
        </span>
        <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
          earned automatically
        </span>
      </div>
    </header>
  );
}
