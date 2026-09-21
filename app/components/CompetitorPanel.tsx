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
    if (!file || file.size > 2_500_000) {setError("En fazla 2,5 MB boyutunda bir pages.json dosyası seçin.");return;}
    setReading(true);
    try {onImport(await file.text());}
    catch {setError("Dosya okunamadı.");}
    finally {setReading(false);}
  }
  const keywords = data.keywords.filter(k => (selected === 'all' || k.domains.includes(selected)) && k.keyword.includes(search.toLowerCase().trim()));
  return <s-page heading="Rakip SEO" inlineSize="large">
    <s-section heading="SweatBlock ve Certain Dri">
      <s-paragraph>Tarayıcının oluşturduğu pages.json dosyasını seçin. Her içe aktarma, ilgili sitenin önceki raporunun yerini alır.</s-paragraph>
      <s-paragraph>Anahtar kelimeler, sayfa metnindeki ifadelerdir. Arama hacmi, Google sıralaması ve gelen backlink verileri bu raporda yer almaz.</s-paragraph>
      <label htmlFor="competitor-file">SEO sonuç dosyası (JSON, en fazla 2,5 MB)</label>
      <input id="competitor-file" type="file" accept=".json,application/json" disabled={busy} onChange={e=>{setFile(e.currentTarget.files?.[0] || null);setError('');}} />
      <s-button variant="primary" disabled={busy || !file} onClick={upload}>{busy?'Import edilir…':"Raporu içe aktar"}</s-button>
      {(error || result?.error) && <s-banner tone="critical">{error || result?.error}</s-banner>}
      {result?.message && !error && <s-banner tone="success">{result.message}</s-banner>}
    </s-section>
    {!data.reports.length && <s-section><s-paragraph>Henüz rapor yok. SweatBlock veya Certain Dri için tarama sonuçlarını içe aktarın.</s-paragraph></s-section>}
    {data.reports.map(report=><s-section key={report.domain} heading={report.domain}>
      <s-paragraph>{report.pages.length} sayfa · Son içe aktarma: {report.importedAt}</s-paragraph>
      <details><summary>Sayfaların SEO bilgileri</summary>{report.pages.map(page=><s-box key={page.url} padding="base">
        <s-heading>{page.title || "Başlık yok"}</s-heading>
        <s-link href={page.url} target="_blank">{page.url}</s-link>
        <s-paragraph>{page.description || "Meta açıklama yok"}</s-paragraph>
        <s-paragraph>Meta keywords: {page.metaKeywords || 'Yoxdur'}</s-paragraph>
        <s-paragraph>H1: {page.headings.filter(h=>h.level==='h1').map(h=>h.text).join(' · ') || 'Yoxdur'}</s-paragraph>
        <details><summary>Dahili bağlantılar ({page.internalLinks?.length || 0})</summary>{page.internalLinks?.map(link=><s-paragraph key={link}><s-link href={link} target="_blank">{link}</s-link></s-paragraph>)}</details>
        <s-paragraph>Google dizin durumu: kontrol edilmedi.</s-paragraph>
        <s-paragraph>Kontrol notları: {page.issues.join(', ') || 'Yoxdur'} · Toplanma: {page.scrapedAt || "Bilinmiyor"}</s-paragraph>
      </s-box>)}</details>
    </s-section>)}
    <s-section heading="Metinden çıkarılan anahtar kelimeler">
      <s-text-field label="Anahtar kelime ara" value={search} onInput={e=>{setSearch(e.currentTarget.value);setOffset(0);}} />
      <s-select label="Site" value={selected} onChange={e=>{setSelected(e.currentTarget.value);setOffset(0);}}>
        <s-option value="all">Her iki site</s-option><s-option value="sweatblock.com">SweatBlock</s-option><s-option value="certaindri.com">Certain Dri</s-option>
      </s-select>
      <s-paragraph>Sayılar, içe aktarılan sayfalardaki öne çıkan ifadeler üzerinden toplanır. Site filtresi eşleşen ifadeleri seçer; toplamlar her iki raporu da kapsar.</s-paragraph>
      <s-table><s-table-header-row><s-table-header>Anahtar kelime</s-table-header><s-table-header>Tekrar sayısı</s-table-header><s-table-header>Sayfa sayısı</s-table-header><s-table-header>Kaynaklar</s-table-header></s-table-header-row>
        <s-table-body>{keywords.slice(offset,offset+50).map(k=><s-table-row key={k.keyword}><s-table-cell>{k.keyword}</s-table-cell><s-table-cell>{k.count}</s-table-cell><s-table-cell>{k.pages}</s-table-cell><s-table-cell>{k.domains.join(', ')}</s-table-cell></s-table-row>)}</s-table-body>
      </s-table>
      <s-paragraph>{keywords.length ? `${offset+1}–${Math.min(offset+50,keywords.length)} / ${keywords.length}` : "Eşleşen anahtar kelime yok."}</s-paragraph>
      <s-button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>Önceki</s-button>
      <s-button disabled={offset+50>=keywords.length} onClick={()=>setOffset(offset+50)}>Sonraki</s-button>
    </s-section>
  </s-page>;
}
