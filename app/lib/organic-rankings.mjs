import {encodeCSV} from './core/csv.mjs';

const total=(rows,key)=>rows.length&&rows.every(r=>typeof r[key]==='number'&&Number.isFinite(r[key]))?rows.reduce((sum,r)=>sum+r[key],0):null;

export function saveOrganicReport(suite,report) {
  const history=(suite.organicReports||[]).filter(r=>!(r.observedAt===report.observedAt&&r.provider===report.provider&&r.device===report.device));
  history.push(report);
  suite.organicReports=history.sort((a,b)=>a.observedAt.localeCompare(b.observedAt)||a.importedAt.localeCompare(b.importedAt)).slice(-30);
}

export function organicRankings(suite) {
  const history=suite.organicReports||[];
  const report=history.at(-1)||suite.domainReports['nosweatusa.com']||null;
  const previous=report?[...history].reverse().find(r=>r.observedAt<report.observedAt&&r.provider===report.provider&&r.country===report.country&&r.language===report.language&&r.device===report.device):null;
  const before=new Map((previous?.rows||[]).map(r=>[r.keyword,r]));
  const rows=(report?.rows||[]).filter(r=>r.position>=1&&r.position<=100).map(r=>{
    const old=before.get(r.keyword);
    const change=old?.position!=null&&r.position!=null?old.position-r.position:null;
    return {...r,previous:old?.position??null,change,status:r.isNew?'new':change===null?'unknown':change>0?'up':change<0?'down':'stable'};
  }).sort((a,b)=>a.position-b.position||a.keyword.localeCompare(b.keyword));
  const groups=new Map();
  for(const row of rows){if(!groups.has(row.url))groups.set(row.url,[]);groups.get(row.url).push(row);}
  const pages=[...groups].map(([url,items])=>({url,keywords:items.length,position:Math.min(...items.map(r=>r.position)),traffic:total(items,'traffic')})).sort((a,b)=>b.keywords-a.keywords);
  const meta=report?{...report}:null;if(meta){delete meta.rows;delete meta.lostRows;}
  const previousRows=previous?.rows.filter(r=>r.position>=1&&r.position<=100);
  const previousSummary=previousRows?{keywords:previousRows.length,traffic:total(previousRows,'traffic'),trafficCost:total(previousRows,'trafficCost'),top10:previousRows.filter(r=>r.position<=10).length}:null;
  return {report:meta,previousDate:previous?.observedAt||null,previousSummary,rows,lostRows:(report?.lostRows||[]).map(r=>({...r,previous:before.get(r.keyword)?.position??null,change:null,status:'lost'})),pages,traffic:total(rows,'traffic'),trafficCost:total(rows,'trafficCost'),history:history.filter(r=>!report||(r.provider===report.provider&&r.device===report.device&&r.country===report.country&&r.language===report.language)).map(r=>({observedAt:r.observedAt,provider:r.provider,count:r.rows.filter(r=>r.position>=1&&r.position<=100).length,distribution:[[1,3],[4,10],[11,20],[21,50],[51,100]].map(([min,max])=>r.rows.filter(k=>k.position>=min&&k.position<=max).length),traffic:total(r.rows.filter(k=>k.position>=1&&k.position<=100),'traffic'),device:r.device}))};
}

export function organicCSV(suite) {
  const {report,rows}=suite.organic||organicRankings(suite);
  return encodeCSV([['keyword','position','previous','change','volume','difficulty','traffic','traffic_cost','cpc','intent','url','serp_updated_at','provider','report_date','country','device'],...rows.map(r=>[r.keyword,r.position,r.previous??'',r.change??'',r.volume??'',r.difficulty??'',r.traffic??'',r.trafficCost??'',r.cpc??'',r.intent||'',r.url||'',r.serpUpdatedAt||'',report.provider,report.observedAt,report.country,report.device])]);
}
