// Scope reports by property, country, period and grain before showing comparisons.
export function selectSearchReports(reports,property,country='all',period='current',days=0){
 const scoped=reports.filter(r=>r.property===property&&r.country===country&&(!days||(Date.parse(r.endDate)-Date.parse(r.startDate))/86400000+1===days));
 const periods=[...new Set(scoped.map(r=>`${r.startDate}|${r.endDate}`))].sort().reverse();
 const current=periods[0];
 const selected=period==='previous'?periods.find(p=>Date.parse(p.split('|')[1])+86400000===Date.parse(current?.split('|')[0])):current;
 const matching=scoped.filter(r=>`${r.startDate}|${r.endDate}`===selected).sort((a,b)=>b.importedAt.localeCompare(a.importedAt));
 const get=grain=>matching.find(r=>r.grain===grain)||null;
 return {total:get('property'),pages:get('page'),queries:get('page-query'),daily:get('page-date')};
}
export function searchMetrics(report){
 if(!report)return null;
 const clicks=report.rows.reduce((n,r)=>n+r.clicks,0),impressions=report.rows.reduce((n,r)=>n+r.impressions,0);
 return {clicks,impressions,ctr:impressions?clicks/impressions:0,position:impressions?report.rows.reduce((n,r)=>n+r.position*r.impressions,0)/impressions:null};
}
