export function imageResponse(bytes, mime) {
  let offset = 0;
  // Stream backups instead of hitting Vercel's buffered response size limit.
  const body = new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(new Uint8Array(bytes.subarray(offset, offset + 64 * 1024)));
      offset += 64 * 1024;
    },
  });
  return new Response(body, { headers: {
    'Content-Type': mime,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  } });
}
