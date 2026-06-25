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
        style={{ height: 3, background: 'var(--border)' }}
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
        style={{ color: rateColor(rate), minWidth: '2.5rem', textAlign: 'right', fontFamily: 'var(--font-geist-mono)' }}
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
      {/* Summary */}
      {hasData ? (
        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className="font-mono font-bold tabular-nums leading-none"
              style={{
                color: rateColor(learnings.overallAcceptanceRate),
                fontSize: '1.5rem',
                letterSpacing: '-0.03em',
                fontFamily: 'var(--font-geist-mono)',
              }}
            >
              {overallPct}%
            </span>
            <span className="text-xs" style={{ color: 'var(--ink-lo)' }}>
              approval rate
            </span>
            <span
              className="ml-auto font-mono text-xs"
              style={{ color: 'var(--ink-lo)', fontFamily: 'var(--font-geist-mono)' }}
            >
              {learnings.totalDecisions} decisions
            </span>
          </div>

          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 3, background: 'var(--border)' }}
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
          className="rounded-md p-3"
          style={{
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-lo)' }}>
            Approve or skip a company to start training the model. Conversion rates and pricing preferences will appear here.
          </p>
        </div>
      )}

      {/* Per-category breakdown */}
      {learnings.categories.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium" style={{ color: 'var(--ink-lo)' }}>
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
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium" style={{ color: 'var(--ink-lo)' }}>
            Recent adjustments
          </span>
          {learnings.recentAdjustments.map((line, i) => (
            <div
              key={i}
              className="text-xs leading-relaxed px-2.5 py-2 rounded-md"
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
