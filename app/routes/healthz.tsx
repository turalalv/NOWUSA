// Liveness only: frequent health probes must not keep the Neon compute awake.
export const loader = () => new Response('ok', {
  headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
});
