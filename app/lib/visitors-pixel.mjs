// Custom pixel: install once in Shopify Settings > Customer events.
// Only Shopify's documented standard APIs are used; no storefront DOM access.
export function visitorPixel({endpoint,publicKey}){
 return `// No Sweat SEO — visitor analytics v1. Analytics permission REQUIRED; data sale NOT applicable.
(() => {
 const endpoint = ${JSON.stringify(endpoint)}, key = ${JSON.stringify(publicKey)};
 const hosts = ['nosweatusa.com','www.nosweatusa.com','iyhxfe-mw.myshopify.com'];
 const storageKey = 'nosweat_visit_v1';
 let consent = init.customerPrivacy, memory = null, queue = Promise.resolve();
 api.customerPrivacy.subscribe('visitorConsentCollected', event => {
  consent = event.customerPrivacy;
  if (!consent.analyticsProcessingAllowed) { memory = null; browser.sessionStorage.removeItem(storageKey).catch(() => {}); }
 });
 const safe = (value, max) => typeof value === 'string' && /^[\\p{L}\\p{N} ._+:/-]*$/u.test(value) && !value.includes('@') ? value.slice(0,max) : '';
 async function send(event) {
  if (!consent?.analyticsProcessingAllowed) return;
  const doc = event.context.document, url = new URL(doc.location.href);
  if (!hosts.includes(url.hostname)) return;
  const path = url.pathname;
  if (!/^\\/(?:[a-z]{2}(?:-[a-z]{2})?\\/)?(?:$|products\\/[a-z0-9-]+\\/?$|collections(?:\\/[a-z0-9-]+(?:\\/products\\/[a-z0-9-]+)?)?\\/?$|pages\\/[a-z0-9-]+\\/?$|blogs\\/[a-z0-9-]+(?:\\/[a-z0-9-]+)?\\/?$)/i.test(path)) return;
  const now = Date.now();
  let session = memory;
  if (!session) { try { session = JSON.parse(await browser.sessionStorage.getItem(storageKey)); } catch {} }
  if (!consent?.analyticsProcessingAllowed) return;
  if (!session || now-session.last > 1800000 || session.day !== new Date().toISOString().slice(0,10)) {
   let ref = ''; try { ref = new URL(doc.referrer).hostname; } catch {}
   if (hosts.includes(ref)) ref = '';
   const source = safe(url.searchParams.get('utm_source'),100) || (url.searchParams.has('gclid') ? 'google' : '') || (url.searchParams.has('ttclid') ? 'tiktok' : '') || ref || '(direct)';
   const medium = safe(url.searchParams.get('utm_medium'),60) || ((url.searchParams.has('gclid')||url.searchParams.has('ttclid')) ? 'cpc' : ref ? 'referral' : '(none)');
   session = {id:crypto.randomUUID(), day:new Date().toISOString().slice(0,10), source, medium, campaign:safe(url.searchParams.get('utm_campaign'),120), last:now};
  }
  session.last = now; memory = session;
  try { await browser.sessionStorage.setItem(storageKey,JSON.stringify(session)); } catch {}
  if (!consent?.analyticsProcessingAllowed) return;
  const ua = event.context.navigator.userAgent || '';
  const payload = {key, consent:true, host:url.hostname, id:event.id, visit:session.id, kind:event.name, at:event.timestamp, path, source:session.source, medium:session.medium, campaign:session.campaign, device:/iPad|Tablet/i.test(ua)?'tablet':/Mobile|Android|iPhone/i.test(ua)?'mobile':'desktop'};
  await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true});
 }
 ['page_viewed','product_viewed'].forEach(name => analytics.subscribe(name,event => { queue = queue.then(() => send(event)).catch(() => {}); }));
})();
`;
}
