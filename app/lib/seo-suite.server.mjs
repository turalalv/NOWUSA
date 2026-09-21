import {saveOrganicReport,organicRankings,organicCSV} from './organic-rankings.mjs';
import crypto from 'node:crypto';
import {validateAuditConfig} from './audit-config.mjs';
import {suiteState,suiteSettings,importSuiteCSV,keywordGap,rankChanges,reportCSV} from './seo-suite.mjs';
import {fetchSuiteProvider,providerConfigured} from './seo-provider.server.mjs';
import {advancedAudit,pageSpeed} from './seo-audit.server.mjs';
import {selectSearchReports,searchMetrics} from './search-reports.mjs';
export function suiteData(state){const s=suiteState(state),result={...s,organic:organicRankings(s),gaps:keywordGap(s),rankChanges:rankChanges(s),providerConfigured:providerConfigured()};delete result.organicReports;return result;}
export function generateDigest(state,now=new Date()){
 const s=suiteState(state),audit=s.audits.at(-1),at=now.toISOString(),day=at.slice(0,10),items=[];
 const emit=(key,title,detail)=>items.push({id:crypto.createHash('sha256').update(key).digest('hex').slice(0,20),at,title,detail,read:false});
 for(const r of rankChanges(s))if(r.change!==null&&r.change<=-5)emit(`rank:${s.ranks.at(-1)?.observedAt}:${r.keyword}:${r.device}`,'Sıralama geriledi',`${r.keyword} (${r.device}): ${r.previous} → ${r.position}`);
 if(audit&&Date.parse(at)-Date.parse(audit.checkedAt)<48*3600000)for(const f of audit.findings.filter(f=>['Kırık sayfa','Noindex','Yönlendirme zinciri'].includes(f.type)))emit(`audit:${f.type}:${f.url}`,f.type,`${f.url} · ${f.detail}`);
 const reports=state.growth?.reports||[],latest=reports.filter(r=>r.grain==='property'&&r.country==='usa').sort((a,b)=>b.importedAt.localeCompare(a.importedAt))[0];
 let traffic=null;
 if(latest){const all=[...(state.gsc||[]),...reports],a=selectSearchReports(all,latest.property,'usa','current',state.googleDays||28).total,b=selectSearchReports(all,latest.property,'usa','previous',state.googleDays||28).total;const current=searchMetrics(a),previous=searchMetrics(b);traffic=current?{...current,startDate:a.startDate,endDate:a.endDate,importedAt:a.importedAt}:null;if(current&&previous&&previous.clicks>=20&&current.clicks<=previous.clicks*.7&&Date.parse(at)-Date.parse(a.importedAt)<3*86400000)emit(`traffic:${a.property}:${a.startDate}:${a.endDate}`,'ABD tıklamaları azaldı',`${previous.clicks} → ${current.clicks}; önceki eşit uzunluktaki dönemle karşılaştırma. Nedeni henüz belirlenmedi.`);}
 if(s.backlinks&&Date.parse(at)-Date.parse(s.backlinks.importedAt)<48*3600000)for(const b of s.backlinks.rows.filter(b=>b.status==='lost'))emit(`lost:${b.source}:${b.target}`,'Sağlayıcı kayıp backlink bildirdi',b.source);
 const existing=new Set(s.alerts.map(a=>a.id));s.alerts.push(...items.filter(a=>!existing.has(a.id)));s.alerts=s.alerts.slice(-200);
 const digest={at,day,traffic,trackedKeywords:s.settings.keywords.length,rankRows:s.ranks.at(-1)?.rows.length||0,auditPages:audit?.pages.length||0,auditFindings:audit?.findings.length||0,auditAt:audit?.checkedAt||null,backlinkRows:s.backlinks?.rows.length||0,newAlerts:items.filter(a=>!existing.has(a.id)).length};s.digests=s.digests.filter(d=>d.day!==day);s.digests.push(digest);s.digests=s.digests.slice(-60);return digest;
}
async function refreshProvider(s,kind,fetcher=fetchSuiteProvider){
 const report=await fetcher(s,kind);
 if(kind==='ranks'){s.ranks=s.ranks.filter(r=>r.observedAt!==report.observedAt||r.provider!==report.provider);s.ranks.push(report);s.ranks=s.ranks.slice(-60);}else if(kind==='organic'){saveOrganicReport(s,report);s.domainReports[report.domain]=report;}else if(kind==='gaps')s.domainReports={...s.domainReports,...report};else s[kind]=report;
}
export async function suiteOperation(state,input,deps={}){
 const s=suiteState(state),audit=deps.audit||advancedAudit,provider=deps.provider||fetchSuiteProvider;
 switch(input.intent){
  case 'suite-settings':if(input.providerAuto==='true'&&!providerConfigured())throw new Error('Otomatik ücretli veri için önce API hesabı yapılandırılmalıdır.');suiteSettings(state,input);return 'SEO Merkezi ayarları kaydedildi.';
  case 'suite-import':return `${importSuiteCSV(state,input)} gerçek veri satırı içe aktarıldı.`;
  case 'suite-provider':if(!['organic','ranks','gaps','keywords','backlinks'].includes(input.kind))throw new Error('Rapor türü geçersiz.');await refreshProvider(s,input.kind,provider);generateDigest(state);return 'SEO sağlayıcısı raporu getirildi.';
  case 'suite-audit-settings':s.auditConfig=validateAuditConfig(JSON.parse(input.config||'{}'));return 'Denetim yapılandırması kaydedildi.';
  case 'suite-audit':{const config=validateAuditConfig(input.config?JSON.parse(input.config):s.auditConfig);const report=await audit(state.catalog.pages,undefined,config);s.auditConfig=config;s.audits.push(report);s.audits=s.audits.slice(-10);generateDigest(state);return 'Geniş teknik denetim tamamlandı.';}
  case 'suite-speed':s.speed=await (deps.speed||pageSpeed)();return s.speed.rows.some(r=>r.error)?'Bazı hız ölçümleri alınamadı; ayrıntıları kontrol edin.':'PageSpeed ölçümleri getirildi.';
  case 'suite-digest':generateDigest(state);return 'Günlük özet ve uygulama içi uyarılar güncellendi.';
  case 'suite-read':s.alerts=s.alerts.map(a=>a.id===input.id?{...a,read:true}:a);return 'Uyarı okundu olarak işaretlendi.';
  case 'suite-daily':{
   if(!s.settings.auto)return 'SEO Merkezi günlük işleri kapalı.';
   if(s.lastDailyAt&&Date.now()-Date.parse(s.lastDailyAt)<20*3600000)return 'Bugünkü kontrol zaten tamamlandı.';
   const errors=[],steps=[],deadline=Date.now()+480000;
   try{s.audits.push(await audit(state.catalog.pages,undefined,s.auditConfig));s.audits=s.audits.slice(-10);steps.push('audit');}catch{errors.push('Teknik denetim başarısız.');}
   if(s.settings.providerAuto){for(const kind of ['ranks','keywords','gaps','backlinks']){if(['ranks','keywords'].includes(kind)&&!s.settings.keywords.length)continue;if(kind==='gaps'&&!s.settings.competitors.length)continue;try{await refreshProvider(s,kind,(state,type)=>provider(state,type,undefined,Math.min(deadline,Date.now()+120000)));steps.push(kind);}catch{errors.push(`${kind}: sağlayıcı verisi alınamadı; önceki rapor korundu.`);}}}
   generateDigest(state);s.lastDailyAt=new Date().toISOString();s.runs.push({at:s.lastDailyAt,steps,errors});s.runs=s.runs.slice(-30);return errors.length?'Günlük kontrol kısmen tamamlandı; çalışma kaydını inceleyin.':'Günlük denetim, rapor ve uyarılar tamamlandı.';
  }
  default:throw new Error('SEO Merkezi işlemi bulunamadı.');
 }
}
export {reportCSV,organicCSV};
