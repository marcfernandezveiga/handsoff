'use client';

import type { LearningsPayload } from '@/lib/types';

interface Props {
  learnings: LearningsPayload;
}

function AcceptanceBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    rate >= 0.7
      ? 'var(--accent-green)'
      : rate >= 0.4
        ? 'var(--accent-amber)'
        : 'var(--accent-red)';
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ height: 4, background: 'var(--bg-border)' }}
      >
        <div
          className="h-full rounded-full learning-bar-fill"
          style={{ width: `${pct}%`, background: color, transition: 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </div>
      <span
        className="text-xs font-mono font-semibold tabular-nums"
        style={{ color, minWidth: 30, textAlign: 'right' }}
      >
        {pct}%
      </span>
    </div>
  );
}

function RateGlyph({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color =
    rate >= 0.7
      ? 'var(--accent-green)'
      : rate >= 0.4
        ? 'var(--accent-amber)'
        : 'var(--accent-red)';
  const label = rate >= 0.7 ? 'Strong' : rate >= 0.4 ? 'Building' : 'Early';
  return (
    <div className="flex items-center gap-3">
      {/* Big rate number */}
      <span
        className="font-mono font-bold tabular-nums leading-none"
        style={{ color, fontSize: '2.5rem', letterSpacing: '-0.03em' }}
      >
        {pct}
        <span className="text-lg" style={{ opacity: 0.7 }}>%</span>
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold" style={{ color }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          approval rate
        </span>
      </div>
    </div>
  );
}

export function LearningsPanel({ learnings }: Props) {
  const overallPct = Math.round(learnings.overallAcceptanceRate * 100);
  const hasData = learnings.totalDecisions > 0;
  const overallColor =
    learnings.overallAcceptanceRate >= 0.7
      ? 'var(--accent-green)'
      : learnings.overallAcceptanceRate >= 0.4
        ? 'var(--accent-amber)'
        : 'var(--accent-red)';

  return (
    <div
      className="mx-3 my-3 rounded-xl overflow-hidden animate-fade-up"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-border)',
        animationDelay: '100ms',
      }}
    >
      {/* Header row */}
      <div
        className="px-4 pt-4 pb-3 flex items-start justify-between gap-3"
        style={{ borderBottom: '1px solid var(--bg-border)' }}
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="relative flex items-center justify-center w-3 h-3">
              <span
                className="animate-pulse-ring absolute inset-0 rounded-full"
                style={{ background: '#7c3aed', opacity: 0.35 }}
              />
              <span
                className="animate-pulse-dot relative inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: '#7c3aed' }}
              />
            </div>
            <span
              className="text-xs font-bold uppercase"
              style={{ color: '#7c3aed', letterSpacing: '0.1em' }}
            >
              Intelligence
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Learns which reminders convert
          </p>
        </div>
        <span
          className="text-xs font-mono px-2 py-1 rounded-md shrink-0"
          style={{
            background: 'rgba(124,58,237,0.1)',
            color: '#7c3aed',
            border: '1px solid rgba(124,58,237,0.2)',
          }}
        >
          {learnings.totalDecisions} decision{learnings.totalDecisions !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Overall acceptance rate - hero stat in the panel */}
        {hasData ? (
          <div>
            <RateGlyph rate={learnings.overallAcceptanceRate} />
            <div className="mt-3">
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: 6, background: 'var(--bg-border)' }}
              >
                <div
                  className="h-full rounded-full learning-bar-fill"
                  style={{
                    width: `${overallPct}%`,
                    background: overallColor,
                    transition: 'width 1000ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-lg p-3 text-center"
            style={{
              background: 'rgba(124,58,237,0.06)',
              border: '1px dashed rgba(124,58,237,0.2)',
            }}
          >
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Send or skip a company to start training the agent. Conversion rate, pricing, and company-type preferences will appear here.
            </p>
          </div>
        )}

        {/* Per-category breakdown */}
        {learnings.categories.length > 0 && (
          <div>
            <div
              className="text-xs font-semibold uppercase mb-2.5"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              By category
            </div>
            <div className="flex flex-col gap-3">
              {learnings.categories.slice(0, 5).map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-xs font-medium capitalize"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {cat.category.replace(/-/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-mono font-semibold"
                        style={{ color: 'var(--accent-green)' }}
                      >
                        ${(cat.learnedFeeCents / 100).toFixed(2)}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        learned price
                      </span>
                    </div>
                  </div>
                  <AcceptanceBar rate={cat.acceptanceRate} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent adjustments */}
        {learnings.recentAdjustments.length > 0 && (
          <div>
            <div
              className="text-xs font-semibold uppercase mb-2"
              style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
            >
              Recent adjustments
            </div>
            <div className="flex flex-col gap-1.5">
              {learnings.recentAdjustments.map((line, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs leading-relaxed px-2.5 py-2 rounded-md"
                  style={{
                    background: 'rgba(124,58,237,0.06)',
                    border: '1px solid rgba(124,58,237,0.12)',
                  }}
                >
                  <span style={{ color: '#7c3aed', marginTop: 1, flexShrink: 0 }}>+</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
