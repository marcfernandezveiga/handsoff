import { Dashboard } from '@/components/Dashboard';
import { getDashboardData } from '@/lib/dashboard';
import type { DashboardPayload } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let initial: DashboardPayload;
  try {
    initial = await getDashboardData();
  } catch {
    initial = {
      jobs: [],
      events: [],
      revenueCents: 0,
      counts: { found: 0, awaiting: 0, charged: 0, skipped: 0 },
      learnings: {
        overallAcceptanceRate: 0,
        totalDecisions: 0,
        categories: [],
        recentAdjustments: [],
      },
      paused: false,
    };
  }

  return <Dashboard initial={initial} />;
}
