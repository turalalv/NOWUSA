import { plain } from './seo.mjs';
export const API_VERSION = '2026-07';
export function storeHost(value) {
  const host = String(value || '').trim().replace(/^https:\/\//, '').replace(/\/$/, '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) throw new Error("Mağazanın xxx.myshopify.com adresini girin.");
  return host;
}
export async function request(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error("Ağ bağlantısı kurulamadı. İnternet bağlantısını ve mağaza adresini kontrol edin."); }
  if (!response.ok) throw new Error(`Kaynak HTTP ${response.status} döndürdü. Erişim iznini ve adresi kontrol edin.`);
  const text = await response.text();
  if (text.length > 12_000_000) throw new Error("Yanıt çok büyük.");
  return text;
}
export class Shopify {
  constructor(config) { this.config = config; this.host = storeHost(config.SHOPIFY_STORE); }
  async token() {
    if (this.config.SHOPIFY_ACCESS_TOKEN) return this.config.SHOPIFY_ACCESS_TOKEN;
    if (this.cached && Date.now() < this.expiresAt) return this.cached;
    if (!this.config.SHOPIFY_CLIENT_ID || !this.config.SHOPIFY_CLIENT_SECRET) throw new Error("Shopify API anahtarı eklenmedi. Bağlantılar bölümünü açın.");
    const result = JSON.parse(await request(`https://${this.host}/admin/oauth/access_token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.config.SHOPIFY_CLIENT_ID, client_secret: this.config.SHOPIFY_CLIENT_SECRET })
    }));
    if (!result.access_token) throw new Error("Shopify erişim anahtarı alınamadı.");
    this.cached = result.access_token; this.expiresAt = Date.now() + (result.expires_in || 3600) * 1000 - 60000;
    return this.cached;
  }
  async query(query, variables = {}) {
    const token = await this.token();
    const result = JSON.parse(await request(`https://${this.host}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-shopify-access-token': token }, body: JSON.stringify({ query, variables })
    }));
    if (result.errors?.length) throw new Error("Shopify isteği başarısız oldu. API izinlerini ve 2026-07 sürümünü kontrol edin.");
    if (!result.data) throw new Error("Shopify veri döndürmedi.");
    return result.data;
  }
  async identity() { return (await this.query('{ shop { name myshopifyDomain primaryDomain { url } } }')).shop; }
  async catalog() {
    const shop = await this.identity(), pages = [];
    for (const type of ['product', 'collection']) {
      let after = null, more = true;
      while (more) {
        const fields = type === 'product' ? 'onlineStoreUrl status vendor tags media(first: 100) { nodes { ... on MediaImage { id alt image { url } } } pageInfo { hasNextPage } }' : 'image { url altText }';
        const data = await this.query(`query Catalog($after: String) { ${type}s(first: 50, after: $after) { nodes { id title handle descriptionHtml updatedAt seo { title description } ${fields} } pageInfo { hasNextPage endCursor } } }`, { after });
        const connection = data[`${type}s`];
        pages.push(...connection.nodes.map(p => ({ ...p, type, source: 'shopify', images: p.media?.nodes?.filter(m=>m.id&&m.image).map(m=>({id:m.id,url:m.image.url,altText:m.alt||''})) || (p.image ? [p.image] : []), imagesTruncated: p.media?.pageInfo?.hasNextPage || false, url: type==='collection'?`${shop.primaryDomain.url.replace(/\/$/,'')}/collections/${encodeURIComponent(p.handle)}`:p.onlineStoreUrl || '', tags: p.tags || [], status: p.status || 'UNKNOWN' })));
        more = connection.pageInfo.hasNextPage; after = connection.pageInfo.endCursor;
        if (pages.length >= 5000 && more) throw new Error("5000 sayfa sınırı aşıldı. Katalog kaydedilmedi; büyük mağazalar için toplu içe aktarma gereklidir.");
      }
    }
    return { shop: { name: shop.name, domain: shop.primaryDomain.url, adminDomain: shop.myshopifyDomain }, pages, source: 'shopify', syncedAt: new Date().toISOString(), warnings: ["Koleksiyon URL’leri, URL tanıtıcısına göre hesaplandı. Açık olup olmadıklarını Teknik SEO bölümünde kontrol edin."] };
  }
  async readSEO(id, type) {
    const data = await this.query(`query Current($id: ID!) { node(id: $id) { ... on ${type === 'product' ? 'Product' : 'Collection'} { id updatedAt seo { title description } } } }`, { id });
    if (!data.node) throw new Error("Sayfa Shopify’da bulunamadı.");
    return data.node;
  }
  async updateSEO(page, seo) {
    const product = page.type === 'product';
    const operation = product ? 'productUpdate' : 'collectionUpdate', inputType = product ? 'ProductUpdateInput' : 'CollectionInput', argument = product ? 'product' : 'input', resource = product ? 'product' : 'collection';
    const result = (await this.query(`mutation SEO($input: ${inputType}!) { ${operation}(${argument}: $input) { ${resource} { id updatedAt seo { title description } } userErrors { field message } } }`, { input: { id: page.id, seo } }))[operation];
    if (result.userErrors?.length) throw new Error(`Shopify düzenlemeyi kabul etmedi: ${result.userErrors.map(e => e.message).join('; ')}`);
    if (!result[resource]) throw new Error("Shopify güncellenen sayfayı döndürmedi.");
    return result[resource];
  }
}
function attrs(tag) {
  const result = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[m[1].toLowerCase()] = plain(m[2] ?? m[3] ?? m[4]);
  return result;
}
export function inspectHTML(html) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const metas = [...markup.matchAll(/<meta\b[^>]*>/gi)].map(m => attrs(m[0]));
  const links = [...markup.matchAll(/<link\b[^>]*>/gi)].map(m => attrs(m[0]));
  const types = new Set(); let invalidSchema = 0;
  const walk = value => { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') { if (value['@type']) [value['@type']].flat().forEach(t => types.add(t)); Object.values(value).filter(v => typeof v === 'object').forEach(walk); } };
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) if (attrs(m[1]).type === 'application/ld+json') { try { walk(JSON.parse(m[2])); } catch { invalidSchema++; } }
  const title = plain(markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  return { title, description: metas.find(m => m.name?.toLowerCase() === 'description')?.content || '', canonical: links.find(l => l.rel?.toLowerCase() === 'canonical')?.href || '', h1Count: [...markup.matchAll(/<h1\b/gi)].length, noindex: metas.some(m => ['robots','googlebot'].includes(m.name?.toLowerCase()) && /noindex/i.test(m.content)), schemaTypes: [...types], invalidSchema, images: [...markup.matchAll(/<img\b[^>]*>/gi)].map(m => attrs(m[0])) };
}
// Personal-store importer: destination is deliberately fixed to the owner's confirmed storefront.
export async function publicCatalog() {
  const domain = 'https://nosweatusa.com', pages = [], warnings = [];
  for (let page = 1; page <= 20; page++) {
    const data = JSON.parse(await request(`${domain}/products.json?limit=250&page=${page}`));
    if (!Array.isArray(data.products)) throw new Error("Mağaza, herkese açık ürün kataloğunu döndürmedi. CSV içe aktarmayı kullanın.");
    for (const p of data.products) pages.push({ id: `public:product:${p.id}`, type: 'product', source: 'public', title: p.title, handle: p.handle, descriptionHtml: p.body_html || '', seo: { title: '', description: '' }, images: (p.images || []).map(im => ({ url: im.src, altText: im.alt || '' })), tags: Array.isArray(p.tags) ? p.tags : String(p.tags || '').split(',').filter(Boolean), status: 'ACTIVE', url: `${domain}/products/${p.handle}` });
    if (data.products.length < 250) break;
    if (page === 20) throw new Error("Herkese açık katalog, 5000 ürün sınırını aştı.");
  }
  try {
    const data = JSON.parse(await request(`${domain}/collections.json?limit=250`));
    if (data.collections?.length === 250) warnings.push("Koleksiyon içe aktarma, ilk 250 sonuçla sınırlıdır. Tam katalog için Shopify API bağlantısını kullanın.");
    for (const c of data.collections || []) pages.push({ id: `public:collection:${c.id}`, type: 'collection', source: 'public', title: c.title, handle: c.handle, descriptionHtml: c.body_html || c.description || '', seo: { title: '', description: '' }, images: c.image ? [{ url: c.image.src, altText: c.image.alt || '' }] : [], tags: [], status: 'PUBLISHED', url: `${domain}/collections/${c.handle}` });
  } catch { warnings.push("Herkese açık koleksiyon kataloğu alınamadı. Koleksiyonlar için Shopify API bağlantısını kullanın."); }
  if (!pages.length) throw new Error("Herkese açık katalogda ürün bulunamadı. CSV içe aktarmayı veya Shopify bağlantısını kullanın.");
  if (pages.length > 100) warnings.push("HTML kontrolü ilk 100 sayfayla sınırlıdır; kalan sayfalarda meta veriler kontrol edilmedi.");
  for (let i = 0; i < pages.length; i += 4) {
    await Promise.all(pages.slice(i, Math.min(i + 4, 100)).map(async p => {
      try {
        const inspected = inspectHTML(await request(p.url));
        p.images = p.images.map(image => {
          const filename = new URL(image.url).pathname.split('/').pop();
          const matches = inspected.images.filter(im => [im.src, im['data-src'], im.srcset].some(src => src?.includes(filename)));
          return { ...image, altText: matches.find(im => im.alt)?.alt || image.altText, altKnown: matches.length > 0 || Boolean(image.altText) };
        });
        p.seo = { title: inspected.title, description: inspected.description }; p.technical = inspected; delete p.technical.images;
        p.metaVerified = true;
      } catch { p.metaVerified = false; warnings.push(`${p.title}: HTML alınamadı; meta kontrolleri yapılmadı.`); }
    }));
    if (i >= 100) break;
  }
  for (const p of pages) if (p.metaVerified !== true) { p.metaVerified = false; p.images = p.images.map(im => ({ ...im, altKnown: Boolean(im.altText) })); }
  return { shop: { name: 'No Sweat USA', domain }, pages, source: 'public', syncedAt: new Date().toISOString(), warnings };
}
