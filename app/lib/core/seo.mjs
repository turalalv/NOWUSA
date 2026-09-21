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
  return { title: cut(title + suffix, 65), description: cut(plain(page.descriptionHtml), 155), note: 'Mənbə mətnindən hazırlanıb. Məhsul faktlarını yoxlayın; yeni satış və ya sağlamlıq iddiası əlavə olunmur.' };
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
    if (!title) add('title_missing', 'high', 'Başlıq yoxdur', 'Axtarış nəticəsi üçün səhifəni aydın təsvir edən başlıq yazın.');
    if (title.length > 65) add('title_long', 'medium', 'Başlıq uzundur', `${title.length} simvol. Təxminən 65 simvol redaktə bələdçisidir; Google üçün sərt limit deyil.`);
    if (title && title.length < 20) add('title_short', 'low', 'Başlıq daha konkret ola bilər', 'Məhsulun növünü və fərqləndirici xüsusiyyətini dəqiqləşdirin.');
    if ((groups.get(norm(title)) || []).length > 1) add('title_duplicate', 'high', 'Başlıq təkrarlanır', 'Digər səhifə ilə eyni başlıq istifadə olunur. Hər səhifənin məqsədini ayırın.');
    if (!description) add('meta_missing', 'medium', 'Xüsusi meta təsvir yoxdur', 'Shopify mövzu və məzmundan təsvir yarada bilər. Xüsusi təsvirlə təqdimatı dəqiqləşdirin.');
    if (description.length > 160) add('meta_long', 'low', 'Meta təsvir uzundur', `${description.length} simvol. Görünən uzunluq cihaz və sorğuya görə dəyişir.`);
    if (description && (descGroups.get(norm(description)) || []).length > 1) add('meta_duplicate', 'medium', 'Meta təsvir təkrarlanır', 'Bu səhifəyə xas mətn hazırlayın.');
    const words = wordCount(p.descriptionHtml);
    if (!words) add('body_missing', 'high', 'Məhsul / kolleksiya mətni yoxdur', 'Məhsul xüsusiyyətlərini və alıcının suallarının cavablarını əlavə edin.');
    else if (words < 60) add('body_review', 'low', 'Mətnin faydalılığını yoxlayın', `${words} söz var. Sabit söz sayı sıralama tələbi deyil; məlumatın yetərli olduğunu yoxlayın.`);
    const missingAlt = (p.images || []).filter(im => im.altKnown !== false && !im.altText?.trim()).length;
    if (missingAlt) add('alt_missing', 'medium', 'Şəkil təsvirləri boşdur', `${missingAlt} şəkli nəzərdən keçirin. Məlumat daşıyan şəkli dəqiq təsvir edin; dekorativ şəkil üçün boş alt uyğun ola bilər.`);
    if (p.status && !['ACTIVE', 'PUBLISHED'].includes(p.status)) add('not_active', 'low', 'Məhsul aktiv deyil', 'Qaralama və arxiv məhsulları üçün SEO işi ikinci dərəcəlidir.');
    const keyword = mappings[p.id]?.trim();
    if (keyword && !norm(title).includes(norm(keyword))) add('keyword_title', 'low', 'Hədəf ifadəni başlıqda nəzərdən keçirin', `“${keyword}” başlıqda yoxdur. Yalnız məzmuna uyğundursa təbii şəkildə əlavə edin.`);
    if (p.technical) {
      const t = p.technical;
      if (t.noindex) add('noindex', 'high', 'Səhifədə noindex var', 'Google-a səhifəni indeksləməmək göstərişi verilib. Bunun məqsədli olub-olmadığını yoxlayın.');
      if (!t.canonical) add('canonical_missing', 'medium', 'Canonical tapılmadı', 'HTML-də əsas URL-i göstərən canonical teqi görünmür.');
      if (t.h1Count !== 1) add('h1_review', 'low', 'Əsas başlığı yoxlayın', `HTML-də ${t.h1Count} H1 var. Səhifənin əsas başlığını aydınlaşdırın.`);
      if (p.type === 'product' && !t.schemaTypes.includes('Product') && !t.schemaTypes.includes('ProductGroup')) add('product_schema', 'medium', 'Product JSON-LD tapılmadı', 'Server HTML-ində məhsul JSON-LD-si tapılmadı. Microdata və JavaScript ilə əlavə edilən schema bu yoxlamaya daxil deyil.');
      if (t.invalidSchema) add('schema_invalid', 'medium', 'JSON-LD sintaksisini yoxlayın', `${t.invalidSchema} JSON-LD bloku parse edilmədi.`);
    }
    if (p.source === 'public' && !p.metaVerified) {
      for (let i = issues.length - 1; i >= 0; i--) if (/^(title_|meta_|keyword_title)/.test(issues[i].code)) issues.splice(i, 1);
      add('meta_unknown', 'low', 'Meta məlumat yoxlanmayıb', 'HTML alınmadığı üçün başlıq və meta təsvir haqqında nəticə çıxarılmayıb.');
    }
    const weights = { high: 18, medium: 10, low: 4 };
    return { ...p, effectiveTitle: title, words, keyword: keyword || '', issues, score: Math.max(0, 100 - issues.reduce((n, issue) => n + weights[issue.severity], 0)) };
  });
}
export function internalLinks(pages) {
  const stop = new Set(['the','and','for','with','from','this','that','your','our','are','bir','üçün']);
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
