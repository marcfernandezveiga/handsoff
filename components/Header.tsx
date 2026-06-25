'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  revenueCents: number;
  jobsDone: number;
  paused: boolean;
  onTogglePause: () => void;
}

function formatRevenue(cents: number): string {
  const pounds = (cents / 100).toFixed(2);
  return `£${pounds}`;
}

export function Header({ revenueCents, jobsDone, paused, onTogglePause }: Props) {
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
        {/* Live indicator — amber when paused, green when running */}
        <div className="relative flex items-center justify-center w-4 h-4">
          {!paused && (
            <span
              className="animate-pulse-ring absolute inset-0 rounded-full"
              style={{ background: 'var(--green)', opacity: 0.35 }}
            />
          )}
          <span
            className={paused ? '' : 'animate-pulse-dot'}
            style={{
              display: 'inline-block',
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '9999px',
              background: paused ? 'var(--amber)' : 'var(--green)',
              position: 'relative',
            }}
          />
        </div>

        <div className="flex flex-col leading-none gap-0.5">
          <span
            style={{ color: 'var(--ink-hi)', letterSpacing: '-0.02em', fontSize: '1rem', fontWeight: 700 }}
          >
            Hands Off
          </span>
          <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
            {paused ? 'Agent paused' : 'AI agent running on its own'}
          </span>
        </div>

        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={
            paused
              ? {
                  background: 'var(--amber-label)',
                  color: 'var(--amber)',
                  border: '1px solid var(--amber-border)',
                }
              : {
                  background: 'var(--green-label)',
                  color: 'var(--green)',
                  border: '1px solid var(--green-border)',
                }
          }
        >
          {paused ? 'paused' : 'live'}
        </span>
      </div>

      <div className="flex-1" />

      {/* Pause / Resume control */}
      <button
        className="btn-ghost"
        onClick={onTogglePause}
        aria-label={paused ? 'Resume agent' : 'Pause agent'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.875rem',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${paused ? 'var(--amber-border)' : 'var(--border)'}`,
          background: paused ? 'var(--amber-dim)' : 'transparent',
          color: paused ? 'var(--amber)' : 'var(--ink-md)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {paused ? (
          <>
            <span style={{ fontSize: '0.875rem' }}>&#9654;</span>
            Resume
          </>
        ) : (
          <>
            <span style={{ fontSize: '0.875rem' }}>&#10074;&#10074;</span>
            Pause
          </>
        )}
      </button>

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
          invoiced, awaiting payment
        </span>
      </div>
    </header>
  );
}
