import {parseCSV} from './core/csv.mjs';

export const BACKLINK_DOMAINS = ['sweatblock.com','certaindri.com','nosweatusa.com'];
const host = url => new URL(url).hostname.replace(/^www\./,'');
const key = value => value.toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases = {
  source:['sourceurl','referringpageurl','source','referringpage'],
  target:['targeturl','target','destinationurl'],
  anchor:['anchor','anchortext','linkanchor'],
  rel:['rel','linkrel'],
  nofollow:['nofollow'],
};
function url(value) {
  let result;try{result=new URL(value.trim());}catch{throw new Error("URL geçerli değil.");}
  if(!['http:','https:'].includes(result.protocol)||result.username||result.password||result.port)throw new Error("URL yalnızca HTTP/HTTPS olmalıdır; giriş bilgileri ve özel port kabul edilmez.");
  result.hash='';return result.href;
}
export function importBacklinkCSV(state,input) {
  if(!BACKLINK_DOMAINS.includes(input.domain))throw new Error("Hedef alan adını seçin.");
  if(typeof input.csv!=='string'||Buffer.byteLength(input.csv)>2_500_000)throw new Error("CSV en fazla 2,5 MB olmalıdır.");
  const rows=parseCSV(input.csv);
  if(rows.length>5000)throw new Error("Her içe aktarmada en fazla 5000 satır kabul edilir.");
  const headers=Object.keys(rows[0]);
  const columns={};
  for(const [field,names] of Object.entries(aliases)) {
    const matches=headers.filter(h=>names.includes(key(h)));
    if(matches.length>1)throw new Error(`${field} için birden fazla eşleşen sütun var; yalnızca birini bırakın.`);
    columns[field]=matches[0];
  }
  if(!columns.source||!columns.target)throw new Error("source_url ve target_url sütunları gereklidir. Referring page URL / Target URL adları da kabul edilir.");
  const links=[],seen=new Set();let duplicates=0;
  for(const [index,row] of rows.entries()) {
    try {
      const source=url(row[columns.source]),target=url(row[columns.target]);
      if(host(target)!==input.domain)throw new Error(`Hedef ${input.domain} alan adına ait değil.`);
      if(host(source)===input.domain)throw new Error("Dahili bağlantı, backlink olarak kabul edilmez.");
      const anchor=(row[columns.anchor]||'').trim().slice(0,500);
      const rawRel=(row[columns.rel]||'').trim().toLowerCase();
      const nf=(row[columns.nofollow]||'').trim().toLowerCase();
      if(nf&&!['true','false','yes','no','1','0'].includes(nf))throw new Error("nofollow değeri true/false, yes/no veya 1/0 olmalıdır.");
      const rel=[...new Set(rawRel.split(/\s+/).filter(Boolean))];
      const nofollow=rel.includes('nofollow')||['true','yes','1'].includes(nf)?true:['false','no','0'].includes(nf)?false:null;
      if(nofollow===true&&!rel.includes('nofollow'))rel.push('nofollow');
      const id=JSON.stringify([source,target,anchor,rel.sort(),nofollow]);
      if(seen.has(id)){duplicates++;continue;}seen.add(id);
      links.push({source,target,sourceHost:host(source),anchor,rel,nofollow,status:'imported_unverified'});
    } catch(error) {throw new Error(`CSV satırı ${index+2}: ${error.message}`);}
  }
  const report={domain:input.domain,provider:String(input.provider||"Kullanıcı CSV’si").trim().slice(0,120)||"Kullanıcı CSV’si",importedAt:new Date().toISOString(),duplicates,links};
  state.backlinkReports={...state.backlinkReports,[input.domain]:report};
  return report;
}
export function backlinkComparison(state) {
  const reports=Object.values(state.backlinkReports||{});
  const own=new Set((state.backlinkReports?.['nosweatusa.com']?.links||[]).map(r=>r.sourceHost));
  const sources=new Map();
  for(const report of reports.filter(r=>r.domain!=='nosweatusa.com'))for(const link of report.links){
    const item=sources.get(link.sourceHost)||{sourceHost:link.sourceHost,domains:new Set(),pages:new Set(),links:0};
    item.domains.add(report.domain);item.pages.add(link.source);item.links++;sources.set(link.sourceHost,item);
  }
  return {reports,hasOwnReport:Boolean(state.backlinkReports?.['nosweatusa.com']),opportunities:[...sources.values()].map(r=>({sourceHost:r.sourceHost,domains:[...r.domains].sort(),sourcePages:[...r.pages].sort(),links:r.links,inOwnImport:own.has(r.sourceHost)})).sort((a,b)=>Number(a.inOwnImport)-Number(b.inOwnImport)||b.domains.length-a.domains.length||b.links-a.links||a.sourceHost.localeCompare(b.sourceHost))};
}
