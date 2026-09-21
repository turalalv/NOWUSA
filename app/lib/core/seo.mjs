export function plain(html = '') {
  return String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
export const wordCount = text => plain(text).split(/\s+/u).filter(Boolean).length;
const norm = v => String(v || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const cut = (v, limit) => v.length <= limit ? v : v.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…';
export function suggestion(page, brand = '') {
  const title = plain(page.title);
  const suffix = brand && !norm(title).includes(norm(brand)) ? ` | ${brand}` : '';
  // Suggestions are extracted from source copy, never invented product claims.
  return { title: cut(title + suffix, 65), description: cut(plain(page.descriptionHtml), 155), note: "Kaynak metinden hazırlandı. Ürün bilgilerini kontrol edin; yeni satış veya sağlık iddiası eklenmez." };
}
export function audit(pages, mappings = {}) {
  const groups = new Map();
  for (const p of pages) {
    const title = norm(p.seo?.title || p.title);
    if (title) groups.set(title, [...(groups.get(title) || []), p.id]);
  }
  const descGroups = new Map();
  for (const p of pages) {
    const desc = norm(p.seo?.description);
    if (desc) descGroups.set(desc, [...(descGroups.get(desc) || []), p.id]);
  }
  return pages.map(p => {
    const issues = []; const add = (code, severity, label, detail) => issues.push({ code, severity, label, detail });
    const title = plain(p.seo?.title || p.title), description = plain(p.seo?.description);
    if (!title) add('title_missing', 'high', "Başlık yok", "Arama sonucu için sayfayı açıkça tanımlayan bir başlık yazın.");
    if (title.length > 65) add('title_long', 'medium', "Başlık uzun", `${title.length} karakter. Yaklaşık 65 karakter bir düzenleme önerisidir; Google için kesin bir sınır değildir.`);
    if (title && title.length < 20) add('title_short', 'low', "Başlık daha açıklayıcı olabilir", "Ürünün türünü ve ayırt edici özelliğini netleştirin.");
    if ((groups.get(norm(title)) || []).length > 1) add('title_duplicate', 'high', "Başlık yineleniyor", "Başka bir sayfayla aynı başlık kullanılıyor. Her sayfanın amacını ayırt edin.");
    if (!description) add('meta_missing', 'medium', "Özel meta açıklama yok", "Shopify, tema ve içerikten açıklama oluşturabilir. Özel açıklamayla sunumu netleştirin.");
    if (description.length > 160) add('meta_long', 'low', "Meta açıklama uzun", `${description.length} karakter. Görünen uzunluk, cihaza ve sorguya göre değişir.`);
    if (description && (descGroups.get(norm(description)) || []).length > 1) add('meta_duplicate', 'medium', "Meta açıklama yineleniyor", "Bu sayfaya özgü bir metin hazırlayın.");
    const words = wordCount(p.descriptionHtml);
    if (!words) add('body_missing', 'high', "Ürün / koleksiyon metni yok", "Ürün özelliklerini ve alıcının sorularının yanıtlarını ekleyin.");
    else if (words < 60) add('body_review', 'low', "Metnin faydasını kontrol edin", `${words} kelime var. Sabit bir kelime sayısı sıralama şartı değildir; bilginin yeterli olduğunu kontrol edin.`);
    const missingAlt = (p.images || []).filter(im => im.altKnown !== false && !im.altText?.trim()).length;
    if (missingAlt) add('alt_missing', 'medium', "Görsel açıklamaları boş", `${missingAlt} görseli inceleyin. Bilgi veren görseli doğru tanımlayın; dekoratif görseller için boş alt metin uygun olabilir.`);
    if (p.status && !['ACTIVE', 'PUBLISHED'].includes(p.status)) add('not_active', 'low', "Ürün aktif değil", "Taslak ve arşiv ürünlerinde SEO çalışması ikinci plandadır.");
    const keyword = mappings[p.id]?.trim();
    if (keyword && !norm(title).includes(norm(keyword))) add('keyword_title', 'low', "Başlıktaki hedef ifadeyi gözden geçirin", `“${keyword}” başlıkta yok. Yalnızca içeriğe uygunsa doğal şekilde ekleyin.`);
    if (p.technical) {
      const t = p.technical;
      if (t.noindex) add('noindex', 'high', "Sayfada noindex var", "Google’a sayfayı dizine eklememesi söylendi. Bunun amaçlı olup olmadığını kontrol edin.");
      if (!t.canonical) add('canonical_missing', 'medium', "Canonical bulunamadı", "HTML içinde ana URL’yi belirten canonical etiketi görünmüyor.");
      if (t.h1Count !== 1) add('h1_review', 'low', "Ana başlığı kontrol edin", `HTML içinde ${t.h1Count} H1 var. Sayfanın ana başlığını netleştirin.`);
      if (p.type === 'product' && !t.schemaTypes.includes('Product') && !t.schemaTypes.includes('ProductGroup')) add('product_schema', 'medium', "Product JSON-LD bulunamadı", "Sunucu HTML’sinde ürün JSON-LD’si bulunamadı. Microdata ve JavaScript ile eklenen şemalar bu kontrole dahil değildir.");
      if (t.invalidSchema) add('schema_invalid', 'medium', "JSON-LD sözdizimini kontrol edin", `${t.invalidSchema} JSON-LD bloğu ayrıştırılamadı.`);
    }
    if (p.source === 'public' && !p.metaVerified) {
      for (let i = issues.length - 1; i >= 0; i--) if (/^(title_|meta_|keyword_title)/.test(issues[i].code)) issues.splice(i, 1);
      add('meta_unknown', 'low', "Meta veriler kontrol edilmedi", "HTML alınamadığı için başlık ve meta açıklama hakkında sonuç çıkarılmadı.");
    }
    const weights = { high: 18, medium: 10, low: 4 };
    return { ...p, effectiveTitle: title, words, keyword: keyword || '', issues, score: Math.max(0, 100 - issues.reduce((n, issue) => n + weights[issue.severity], 0)) };
  });
}
export function internalLinks(pages) {
  const stop = new Set(['the','and','for','with','from','this','that','your','our','are','bir',"için"]);
  const terms = p => new Set(norm(`${p.title} ${(p.tags || []).join(' ')}`).match(/[\p{L}\p{N}]{3,}/gu)?.filter(t => !stop.has(t)) || []);
  const result = [];
  for (const from of pages) {
    const a = terms(from);
    const candidates = pages.filter(to => to.id !== from.id && to.url && !String(from.descriptionHtml || '').includes(to.url) && !String(from.descriptionHtml || '').includes(`/${to.type === 'collection' ? 'collections' : 'products'}/${to.handle}`)).map(to => {
      const common = [...terms(to)].filter(t => a.has(t));
      return { fromId: from.id, fromTitle: from.title, toId: to.id, toTitle: to.title, toUrl: to.url, anchor: to.title, common, relevance: common.length };
    }).filter(c => c.relevance >= 2).sort((a, b) => b.relevance - a.relevance).slice(0, 2);
    result.push(...candidates);
  }
  return result;
}
