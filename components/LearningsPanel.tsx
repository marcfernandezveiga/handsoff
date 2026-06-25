'use client';

import type { LearningsPayload } from '@/lib/types';

interface Props {
  learnings: LearningsPayload;
}

function AcceptanceBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = rate >= 0.7 ? 'var(--accent-green)' : rate >= 0.4 ? 'var(--accent-amber)' : 'var(--accent-red)';
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 4, background: 'var(--bg-border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums" style={{ color, minWidth: 32, textAlign: 'right' }}>
        {pct}%
      </span>
    </div>
  );
}

export function LearningsPanel({ learnings }: Props) {
  const overallPct = Math.round(learnings.overallAcceptanceRate * 100);
  const hasData = learnings.totalDecisions > 0;

  return (
    <div
      className="mx-5 my-4 rounded-lg overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-border)',
        borderLeft: '3px solid #6366f1',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--bg-border)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#6366f1' }}
          />
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            What the agent has learned
          </span>
        </div>
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--text-muted)' }}
        >
          {learnings.totalDecisions} decision{learnings.totalDecisions !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="px-4 py-3 flex flex-col gap-4">
        {/* Overall acceptance rate */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Overall approval rate
            </span>
            <span
              className="text-sm font-bold font-mono"
              style={{
                color: hasData
                  ? learnings.overallAcceptanceRate >= 0.6
                    ? 'var(--accent-green)'
                    : 'var(--accent-amber)'
                  : 'var(--text-muted)',
              }}
            >
              {hasData ? `${overallPct}%` : '--'}
            </span>
          </div>
          {hasData && (
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 6, background: 'var(--bg-border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${overallPct}%`,
                  background:
                    learnings.overallAcceptanceRate >= 0.6
                      ? 'var(--accent-green)'
                      : 'var(--accent-amber)',
                }}
              />
            </div>
          )}
          {!hasData && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Approve or reject a job to start training the agent.
            </p>
          )}
        </div>

        {/* Per-category learned prices */}
        {learnings.categories.length > 0 && (
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Category performance
            </div>
            <div className="flex flex-col gap-2.5">
              {learnings.categories.slice(0, 5).map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-medium capitalize"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {cat.category.replace(/-/g, ' ')}
                    </span>
                    <span
                      className="text-xs font-mono"
                      style={{ color: 'var(--accent-green)' }}
                    >
                      £{(cat.learnedFeeCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <AcceptanceBar rate={cat.acceptanceRate} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent adjustments feed */}
        {learnings.recentAdjustments.length > 0 && (
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-wide mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Recent adjustments
            </div>
            <div className="flex flex-col gap-1">
              {learnings.recentAdjustments.map((line, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-xs leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span style={{ color: '#6366f1', marginTop: 1 }}>+</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
