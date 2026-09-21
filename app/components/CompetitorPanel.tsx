import {useState} from 'react';
import type {ActionResult} from '../lib/types';
type Report = {domain:string;importedAt:string;pages:{url:string;title:string;description:string;metaKeywords:string;scrapedAt:string;headings:{level:string;text:string}[];internalLinks?:string[];issues:string[];keywords:{keyword:string;count:number}[]}[]};
export type CompetitorData = {reports: Report[]; keywords: {keyword:string;count:number;pages:number;domains:string[]}[]};
export default function CompetitorPanel({data, onImport, busy: submitting, result}: {data: CompetitorData; onImport: (json: string) => void; busy: boolean; result?: ActionResult}) {
  const [file, setFile] = useState<File|null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('all');
  const [offset, setOffset] = useState(0);
  const busy = reading || submitting;
  async function upload() {
    setError('');
    if (!file || file.size > 2_500_000) {setError('Maksimum 2.5 MB ölçülü pages.json faylı seçin.');return;}
    setReading(true);
    try {onImport(await file.text());}
    catch {setError('Fayl oxunmadı.');}
    finally {setReading(false);}
  }
  const keywords = data.keywords.filter(k => (selected === 'all' || k.domains.includes(selected)) && k.keyword.includes(search.toLowerCase().trim()));
  return <s-page heading="Rəqib SEO" inlineSize="large">
    <s-section heading="SweatBlock və Certain Dri">
      <s-paragraph>Scraper-dən pages.json faylını seçin. Hər import həmin saytın əvvəlki hesabatını əvəz edir.</s-paragraph>
      <s-paragraph>Açar sözlər səhifə mətnindəki ifadələrdir. Axtarış həcmi, Google sıralaması və gələn backlink məlumatı bu hesabatda yoxdur.</s-paragraph>
      <label htmlFor="competitor-file">SEO nəticə faylı (JSON, maksimum 2.5 MB)</label>
      <input id="competitor-file" type="file" accept=".json,application/json" disabled={busy} onChange={e=>{setFile(e.currentTarget.files?.[0] || null);setError('');}} />
      <s-button variant="primary" disabled={busy || !file} onClick={upload}>{busy?'Import edilir…':'Hesabatı import et'}</s-button>
      {(error || result?.error) && <s-banner tone="critical">{error || result?.error}</s-banner>}
      {result?.message && !error && <s-banner tone="success">{result.message}</s-banner>}
    </s-section>
    {!data.reports.length && <s-section><s-paragraph>Hələ hesabat yoxdur. SweatBlock və ya Certain Dri üçün scraper nəticəsini import edin.</s-paragraph></s-section>}
    {data.reports.map(report=><s-section key={report.domain} heading={report.domain}>
      <s-paragraph>{report.pages.length} səhifə · Son import: {report.importedAt}</s-paragraph>
      <details><summary>Səhifələrin SEO məlumatları</summary>{report.pages.map(page=><s-box key={page.url} padding="base">
        <s-heading>{page.title || 'Başlıq yoxdur'}</s-heading>
        <s-link href={page.url} target="_blank">{page.url}</s-link>
        <s-paragraph>{page.description || 'Meta təsvir yoxdur'}</s-paragraph>
        <s-paragraph>Meta keywords: {page.metaKeywords || 'Yoxdur'}</s-paragraph>
        <s-paragraph>H1: {page.headings.filter(h=>h.level==='h1').map(h=>h.text).join(' · ') || 'Yoxdur'}</s-paragraph>
        <details><summary>Daxili linklər ({page.internalLinks?.length || 0})</summary>{page.internalLinks?.map(link=><s-paragraph key={link}><s-link href={link} target="_blank">{link}</s-link></s-paragraph>)}</details>
        <s-paragraph>Google indeks statusu: yoxlanmayıb.</s-paragraph>
        <s-paragraph>Yoxlama qeydləri: {page.issues.join(', ') || 'Yoxdur'} · Toplanma: {page.scrapedAt || 'Naməlum'}</s-paragraph>
      </s-box>)}</details>
    </s-section>)}
    <s-section heading="Mətndən çıxarılan açar sözlər">
      <s-text-field label="Açar söz axtar" value={search} onInput={e=>{setSearch(e.currentTarget.value);setOffset(0);}} />
      <s-select label="Sayt" value={selected} onChange={e=>{setSelected(e.currentTarget.value);setOffset(0);}}>
        <s-option value="all">Hər iki sayt</s-option><s-option value="sweatblock.com">SweatBlock</s-option><s-option value="certaindri.com">Certain Dri</s-option>
      </s-select>
      <s-paragraph>Saylar import edilən səhifələrin top ifadələri üzrə cəmlənir. Sayt filtri uyğun ifadələri seçir; cəmlər hər iki hesabatı əhatə edir.</s-paragraph>
      <s-table><s-table-header-row><s-table-header>Açar söz</s-table-header><s-table-header>Təkrarlanma</s-table-header><s-table-header>Səhifə sayı</s-table-header><s-table-header>Mənbələr</s-table-header></s-table-header-row>
        <s-table-body>{keywords.slice(offset,offset+50).map(k=><s-table-row key={k.keyword}><s-table-cell>{k.keyword}</s-table-cell><s-table-cell>{k.count}</s-table-cell><s-table-cell>{k.pages}</s-table-cell><s-table-cell>{k.domains.join(', ')}</s-table-cell></s-table-row>)}</s-table-body>
      </s-table>
      <s-paragraph>{keywords.length ? `${offset+1}–${Math.min(offset+50,keywords.length)} / ${keywords.length}` : 'Uyğun açar söz yoxdur.'}</s-paragraph>
      <s-button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Əvvəlki</s-button>
      <s-button disabled={offset+50>=keywords.length} onClick={()=>setOffset(offset+50)}>Növbəti</s-button>
    </s-section>
  </s-page>;
}
