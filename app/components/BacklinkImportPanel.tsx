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
  async function upload(){setError('');if(!file||file.size>2_500_000){setError('Maksimum 2.5 MB CSV faylı seçin.');return;}setReading(true);try{onImport({csv:await file.text(),domain,provider});setOffset(0);}catch{setError('Fayl oxunmadı.');}finally{setReading(false);}}
  const opportunities=data.opportunities.filter(r=>r.sourceHost.includes(search.trim().toLowerCase()));
  const report=data.reports.find(r=>r.domain===domain);
  return <s-page heading="Backlink müqayisəsi" inlineSize="large">
    <s-section heading="Backlink siyahısını import et">
      <s-paragraph>Backlink xidmətindən ixrac etdiyin CSV-ni yüklə. Bu bölmə internetdən yeni backlink axtarmır. Hər import seçilmiş saytın əvvəlki siyahısını əvəz edir.</s-paragraph>
      <s-select label="Linklərin getdiyi sayt" value={domain} disabled={pending} onChange={e=>{setDomain(e.currentTarget.value);setOffset(0);}}><s-option value="sweatblock.com">SweatBlock</s-option><s-option value="certaindri.com">Certain Dri</s-option><s-option value="nosweatusa.com">No Sweat USA — mənim saytım</s-option></s-select>
      <s-text-field label="Məlumat mənbəyi (istəyə bağlı)" value={provider} maxLength={120} onInput={e=>setProvider(e.currentTarget.value)} />
      <s-paragraph>Tələb olunan sütunlar: source_url, target_url. Əlavə sütunlar: anchor, rel, nofollow. Vergüllə ayrılmış UTF-8 CSV, maksimum 5000 sətir.</s-paragraph>
      <label htmlFor="backlink-csv">Backlink CSV faylı</label><input id="backlink-csv" type="file" accept=".csv,text/csv" disabled={pending} onChange={e=>{setFile(e.currentTarget.files?.[0]||null);setError('');}} />
      <s-button variant="primary" disabled={pending||!file} onClick={upload}>{pending?'Import edilir…':'Backlink CSV-ni import et'}</s-button>
      <s-button onClick={()=>download('backlink-template.csv',[['source_url','target_url','anchor','rel','nofollow']])}>Boş CSV şablonunu yüklə</s-button>
      {(error||result?.error)&&<s-banner tone="critical">{error||result?.error}</s-banner>}
      {result?.message&&!error&&<s-banner tone="success">{result.message}</s-banner>}
    </s-section>
    {!data.reports.length&&<s-section><s-paragraph>Hələ backlink məlumatı yoxdur. Real siyahı import ediləndən sonra müqayisə görünəcək.</s-paragraph></s-section>}
    <s-section heading="Importların əhatəsi">
      {data.reports.map(r=><s-paragraph key={r.domain}>{r.domain}: {r.links.length} link · {r.provider} · {r.importedAt} · {r.duplicates} təkrar sətir çıxarıldı</s-paragraph>)}
      <s-paragraph>Linklər CSV-də bildirilib, canlı səhifədə yoxlanmayıb. Import vaxtı linkin yaranma tarixi deyil.</s-paragraph>
      {!data.hasOwnReport&&<s-banner tone="info">No Sweat USA üçün də CSV import et ki, mənbələrin sənin siyahında olub-olmadığı müqayisə edilsin.</s-banner>}
    </s-section>
    <s-section heading="Araşdırılacaq mənbələr">
      <s-paragraph>Əvvəl sənin importunda görünməyən, sonra hər iki rəqibə link verən mənbələr göstərilir. Bu, keyfiyyət reytinqi deyil. Siyahıda olmaması real backlink-in olmamasını təsdiqləmir.</s-paragraph>
      <s-text-field label="Mənbə hostunu axtar" value={search} onInput={e=>{setSearch(e.currentTarget.value);setOffset(0);}} />
      <s-button disabled={!opportunities.length} onClick={()=>download('backlink-opportunities.csv',[['source_host','competitors','source_pages','imported_links','own_import_status'],...opportunities.map(r=>[r.sourceHost,r.domains.join(' | '),r.sourcePages.join(' | '),r.links,data.hasOwnReport?(r.inOwnImport?'present':'not_observed'):'no_own_report'])])}>Müqayisəni CSV kimi yüklə</s-button>
      <s-table><s-table-header-row><s-table-header>Mənbə hostu</s-table-header><s-table-header>Rəqiblər</s-table-header><s-table-header>Import linkləri</s-table-header><s-table-header>Mənim importumda</s-table-header></s-table-header-row><s-table-body>
        {opportunities.slice(offset,offset+50).map(r=><s-table-row key={r.sourceHost}><s-table-cell><s-link href={r.sourcePages[0]} target="_blank">{r.sourceHost}</s-link></s-table-cell><s-table-cell>{r.domains.join(', ')}</s-table-cell><s-table-cell>{r.links}</s-table-cell><s-table-cell>{!data.hasOwnReport?'Müqayisə üçün CSV yoxdur':r.inOwnImport?'Var':'Görünmür'}</s-table-cell></s-table-row>)}
      </s-table-body></s-table>
      <s-paragraph>{opportunities.length?`${offset+1}–${Math.min(offset+50,opportunities.length)} / ${opportunities.length}`:'Uyğun mənbə yoxdur.'}</s-paragraph>
      <s-button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}>Əvvəlki mənbələr</s-button><s-button disabled={offset+50>=opportunities.length} onClick={()=>setOffset(offset+50)}>Növbəti mənbələr</s-button>
    </s-section>
    {report&&<s-section heading={`${domain} — import edilmiş linklər`}><s-paragraph>İlk 100 link göstərilir. Hamısını CSV ilə yükləyə bilərsən. Rel/nofollow dəyərləri mənbə faylındakı məlumatdır.</s-paragraph>
      <s-button onClick={()=>download('backlinks.csv',[['source_url','target_url','anchor','rel','nofollow'],...report.links.map(r=>[r.source,r.target,r.anchor,r.rel.join(' '),r.nofollow===null?'':String(r.nofollow)])])}>Bütün linkləri yüklə</s-button>
      <s-table><s-table-header-row><s-table-header>Mənbə</s-table-header><s-table-header>Hədəf</s-table-header><s-table-header>Anchor</s-table-header><s-table-header>Rel / nofollow</s-table-header></s-table-header-row><s-table-body>{report.links.slice(0,100).map((r,i)=><s-table-row key={i}><s-table-cell><s-link href={r.source} target="_blank">{r.source}</s-link></s-table-cell><s-table-cell><s-link href={r.target} target="_blank">{r.target}</s-link></s-table-cell><s-table-cell>{r.anchor||'Boş'}</s-table-cell><s-table-cell>{r.rel.join(' ')||'Rel bildirilməyib'} / {r.nofollow===null?'nofollow naməlum':String(r.nofollow)}</s-table-cell></s-table-row>)}</s-table-body></s-table>
    </s-section>}
  </s-page>;
}
