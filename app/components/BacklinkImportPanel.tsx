import {useState} from 'react';
import {encodeCSV} from '../lib/core/csv.mjs';
import type {ActionResult} from '../lib/types';
type BacklinkRow={source:string;target:string;sourceHost:string;anchor:string;rel:string[];nofollow:boolean|null;status:string};
type Report={domain:string;provider:string;importedAt:string;duplicates:number;links:BacklinkRow[]};
export type BacklinkData={reports:Report[];hasOwnReport:boolean;opportunities:{sourceHost:string;domains:string[];sourcePages:string[];links:number;inOwnImport:boolean}[]};
function download(name:string,rows:unknown[][]){const href=URL.createObjectURL(new Blob([encodeCSV(rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
export default function BacklinkImportPanel({data,busy,onImport,result}:{data:BacklinkData;busy:boolean;onImport:(input:{csv:string;domain:string;provider:string})=>void;result?:ActionResult}){
  const [file,setFile]=useState<File|null>(null),[domain,setDomain]=useState('sweatblock.com'),[provider,setProvider]=useState(''),[error,setError]=useState(''),[reading,setReading]=useState(false),[search,setSearch]=useState(''),[offset,setOffset]=useState(0);
  const pending=busy||reading;
  async function upload(){setError('');if(!file||file.size>2_500_000){setError("En fazla 2,5 MB boyutunda bir CSV dosyası seçin.");return;}setReading(true);try{onImport({csv:await file.text(),domain,provider});setOffset(0);}catch{setError("Dosya okunamadı.");}finally{setReading(false);}}
  const opportunities=data.opportunities.filter(r=>r.sourceHost.includes(search.trim().toLowerCase()));
  const report=data.reports.find(r=>r.domain===domain);
  return <s-page heading="Backlink karşılaştırması" inlineSize="large">
    <s-section heading="Backlink listesini içe aktar">
      <s-paragraph>Backlink hizmetinden dışa aktardığınız CSV dosyasını yükleyin. Bu bölüm internette yeni backlink aramaz. Her içe aktarma, seçilen sitenin önceki listesinin yerini alır.</s-paragraph>
      <s-select label="Bağlantıların yönlendirildiği site" value={domain} disabled={pending} onChange={e=>{setDomain(e.currentTarget.value);setOffset(0);}}><s-option value="sweatblock.com">SweatBlock</s-option><s-option value="certaindri.com">Certain Dri</s-option><s-option value="nosweatusa.com">No Sweat USA — kendi sitem</s-option></s-select>
      <s-text-field label="Veri kaynağı (isteğe bağlı)" value={provider} maxLength={120} onInput={e=>setProvider(e.currentTarget.value)} />
      <s-paragraph>Gerekli sütunlar: source_url, target_url. Ek sütunlar: anchor, rel, nofollow. Virgülle ayrılmış UTF-8 CSV, en fazla 5000 satır.</s-paragraph>
      <label htmlFor="backlink-csv">Backlink CSV dosyası</label><input id="backlink-csv" type="file" accept=".csv,text/csv" disabled={pending} onChange={e=>{setFile(e.currentTarget.files?.[0]||null);setError('');}} />
      <s-button variant="primary" disabled={pending||!file} onClick={upload}>{pending?'Import edilir…':"Backlink CSV içe aktar"}</s-button>
      <s-button onClick={()=>download('backlink-template.csv',[['source_url','target_url','anchor','rel','nofollow']])}>Boş CSV şablonunu indir</s-button>
      {(error||result?.error)&&<s-banner tone="critical">{error||result?.error}</s-banner>}
      {result?.message&&!error&&<s-banner tone="success">{result.message}</s-banner>}
    </s-section>
    {!data.reports.length&&<s-section><s-paragraph>Henüz backlink verisi yok. Gerçek liste içe aktarıldıktan sonra karşılaştırma görünecek.</s-paragraph></s-section>}
    <s-section heading="İçe aktarılan verilerin kapsamı">
      {data.reports.map(r=><s-paragraph key={r.domain}>{r.domain}: {r.links.length} link · {r.provider} · {r.importedAt} · {r.duplicates} yinelenen satır kaldırıldı</s-paragraph>)}
      <s-paragraph>Bağlantılar CSV dosyasında bildirilmiştir; canlı sayfada kontrol edilmemiştir. İçe aktarma zamanı, bağlantının oluşturulma tarihi değildir.</s-paragraph>
      {!data.hasOwnReport&&<s-banner tone="info">Kaynakların kendi listenizde olup olmadığını karşılaştırmak için No Sweat USA verilerini de CSV olarak içe aktarın.</s-banner>}
    </s-section>
    <s-section heading="Araştırılacak kaynaklar">
      <s-paragraph>Önce kendi listenizde görünmeyen, ardından her iki rakibe bağlantı veren kaynaklar gösterilir. Bu bir kalite sıralaması değildir. Listede bulunmaması, gerçek bir backlink olmadığı anlamına gelmez.</s-paragraph>
      <s-text-field label="Kaynak alan adını ara" value={search} onInput={e=>{setSearch(e.currentTarget.value);setOffset(0);}} />
      <s-button disabled={!opportunities.length} onClick={()=>download('backlink-opportunities.csv',[['source_host','competitors','source_pages','imported_links','own_import_status'],...opportunities.map(r=>[r.sourceHost,r.domains.join(' | '),r.sourcePages.join(' | '),r.links,data.hasOwnReport?(r.inOwnImport?'present':'not_observed'):'no_own_report'])])}>Karşılaştırmayı CSV olarak indir</s-button>
      <s-table><s-table-header-row><s-table-header>Kaynak alan adı</s-table-header><s-table-header>Rakipler</s-table-header><s-table-header>İçe aktarılan bağlantılar</s-table-header><s-table-header>Kendi listemde</s-table-header></s-table-header-row><s-table-body>
        {opportunities.slice(offset,offset+50).map(r=><s-table-row key={r.sourceHost}><s-table-cell><s-link href={r.sourcePages[0]} target="_blank">{r.sourceHost}</s-link></s-table-cell><s-table-cell>{r.domains.join(', ')}</s-table-cell><s-table-cell>{r.links}</s-table-cell><s-table-cell>{!data.hasOwnReport?"Karşılaştırma için CSV yok":r.inOwnImport?'Var':"Görünmüyor"}</s-table-cell></s-table-row>)}
      </s-table-body></s-table>
      <s-paragraph>{opportunities.length?`${offset+1}–${Math.min(offset+50,opportunities.length)} / ${opportunities.length}`:"Eşleşen kaynak yok."}</s-paragraph>
      <s-button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}>Önceki kaynaklar</s-button><s-button disabled={offset+50>=opportunities.length} onClick={()=>setOffset(offset+50)}>Sonraki kaynaklar</s-button>
    </s-section>
    {report&&<s-section heading={`${domain} — içe aktarılan bağlantılar`}><s-paragraph>İlk 100 bağlantı gösterilir. Tümünü CSV olarak indirebilirsiniz. Rel/nofollow değerleri kaynak dosyadaki bilgilerdir.</s-paragraph>
      <s-button onClick={()=>download('backlinks.csv',[['source_url','target_url','anchor','rel','nofollow'],...report.links.map(r=>[r.source,r.target,r.anchor,r.rel.join(' '),r.nofollow===null?'':String(r.nofollow)])])}>Tüm bağlantıları indir</s-button>
      <s-table><s-table-header-row><s-table-header>Kaynak</s-table-header><s-table-header>Hedef</s-table-header><s-table-header>Bağlantı metni</s-table-header><s-table-header>Rel / nofollow</s-table-header></s-table-header-row><s-table-body>{report.links.slice(0,100).map((r,i)=><s-table-row key={i}><s-table-cell><s-link href={r.source} target="_blank">{r.source}</s-link></s-table-cell><s-table-cell><s-link href={r.target} target="_blank">{r.target}</s-link></s-table-cell><s-table-cell>{r.anchor||"Boş"}</s-table-cell><s-table-cell>{r.rel.join(' ')||"Rel belirtilmemiş"} / {r.nofollow===null?"nofollow bilinmiyor":String(r.nofollow)}</s-table-cell></s-table-row>)}</s-table-body></s-table>
    </s-section>}
  </s-page>;
}
