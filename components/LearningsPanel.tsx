'use client';

import type { LearningsPayload } from '@/lib/types';

interface Props {
  learnings: LearningsPayload;
}

function rateColor(rate: number): string {
  if (rate >= 0.7) return 'var(--green)';
  if (rate >= 0.4) return 'var(--amber)';
  return 'var(--red)';
}

function AcceptanceBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 4, background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-full bar-grow"
          style={{
            width: `${pct}%`,
            background: rateColor(rate),
            transition: 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
      <span
        className="font-mono text-xs font-semibold tabular-nums"
        style={{
          color: rateColor(rate),
          minWidth: '2.5rem',
          textAlign: 'right',
          fontFamily: 'var(--font-geist-mono)',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

export function LearningsPanel({ learnings }: Props) {
  const hasData = learnings.totalDecisions > 0;
  const overallPct = Math.round(learnings.overallAcceptanceRate * 100);

  return (
    <div className="px-4 py-4 flex flex-col gap-4 animate-fade-up" style={{ animationDelay: '80ms' }}>
      {hasData ? (
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className="font-mono font-bold tabular-nums leading-none"
              style={{
                color: rateColor(learnings.overallAcceptanceRate),
                fontSize: '1.75rem',
                letterSpacing: '-0.03em',
                fontFamily: 'var(--font-geist-mono)',
              }}
            >
              {overallPct}%
            </span>
            <span className="text-xs" style={{ color: 'var(--ink-md)' }}>
              of reminders got approved
            </span>
          </div>
          <div className="text-xs mb-2" style={{ color: 'var(--ink-lo)' }}>
            Based on {learnings.totalDecisions} decisions
          </div>

          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 4, background: 'var(--border)' }}
          >
            <div
              className="h-full rounded-full bar-grow"
              style={{
                width: `${overallPct}%`,
                background: rateColor(learnings.overallAcceptanceRate),
                transition: 'width 1000ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg p-3.5"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink-hi)' }}>
            The agent is still learning
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-md)' }}>
            Once it has approved or skipped a few companies, you will see how well it is performing here.
          </p>
        </div>
      )}

      {/* Per-category breakdown */}
      {learnings.categories.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold" style={{ color: 'var(--ink-md)' }}>
            By company type
          </span>
          {learnings.categories.slice(0, 5).map((cat) => (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-xs font-medium capitalize"
                  style={{ color: 'var(--ink-hi)' }}
                >
                  {cat.category.replace(/-/g, ' ')}
                </span>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: 'var(--green)', fontFamily: 'var(--font-geist-mono)' }}
                >
                  £{(cat.learnedFeeCents / 100).toFixed(2)}
                </span>
              </div>
              <AcceptanceBar rate={cat.acceptanceRate} />
            </div>
          ))}
        </div>
      )}

      {/* Recent adjustments */}
      {learnings.recentAdjustments.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--ink-md)' }}>
            Recent adjustments
          </span>
          {learnings.recentAdjustments.map((line, i) => (
            <div
              key={i}
              className="text-xs leading-relaxed px-3 py-2.5 rounded-lg"
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                color: 'var(--ink-md)',
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
