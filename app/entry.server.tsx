import { handleRequest } from '@vercel/react-router/entry.server';
import type { AppLoadContext, EntryContext } from 'react-router';
import { addDocumentResponseHeaders } from './shopify.server';

export const streamTimeout = 5000;

export default function handleDocument(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext?: AppLoadContext,
) {
  // Preserve Shopify framing headers with Vercel-compatible response streaming.
  addDocumentResponseHeaders(request, responseHeaders);
  return handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext);
}
