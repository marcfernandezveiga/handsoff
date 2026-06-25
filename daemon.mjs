// Run: BASE_URL=http://localhost:3000 node daemon.mjs

const BASE_URL = process.env.BASE_URL;

if (!BASE_URL) {
  console.error("BASE_URL env var is required. Example: BASE_URL=http://localhost:3000 node daemon.mjs");
  process.exit(1);
}

const INTERVAL_MS = 30_000;

async function tick() {
  const timestamp = new Date().toISOString();
  try {
    const res = await fetch(`${BASE_URL}/api/agent/tick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      console.log(`[${timestamp}] tick → HTTP ${res.status}`);
      return;
    }

    const body = await res.json();
    if (body.ok) {
      // Extract a summary from the response if available
      const summary = body.summary ?? "cycle complete";
      console.log(`[${timestamp}] tick → ${summary}`);
    } else {
      console.log(`[${timestamp}] tick → error: ${body.error ?? "unknown"}`);
    }
  } catch (err) {
    console.log(`[${timestamp}] tick → fetch failed: ${err.message}`);
  }
}

console.log(`Daemon starting. Hitting ${BASE_URL}/api/agent/tick every ${INTERVAL_MS / 1000}s`);

// Run immediately on start, then on interval
tick();
setInterval(tick, INTERVAL_MS);
