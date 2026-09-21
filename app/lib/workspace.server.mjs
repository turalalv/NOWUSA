import crypto from 'node:crypto';
import {importCompetitor} from './competitors.mjs';
import {importBacklinkCSV} from './backlink-import.mjs';
import {growthData,setReadiness,saveOutreach,setTaskDone} from './growth.mjs';
import {syncGoogle, disconnectGoogle} from './google.server.mjs';
import {prepareCompression,applyCompression,checkCompression} from './compression.server.mjs';
import {addBacklink,checkBacklinks,backlinkOpportunities} from './backlinks.server.mjs';
import { Shopify } from './core/shopify.mjs';
import { audit, suggestion, internalLinks } from './core/seo.mjs';
import { importGSC, summarizeGSC } from './core/gsc.mjs';
import { encodeCSV } from './core/csv.mjs';
import { technicalAudit } from './technical.server.mjs';

const cleanSEO = value => ({ title: value?.title || '', description: value?.description || '' });
export const fingerprint = value => crypto.createHash('sha256').update(JSON.stringify(cleanSEO(value))).digest('hex');
export function initialWorkspace(shop) {
  return { catalog:{shop:{name:'No Sweat USA',domain:'https://nosweatusa.com',adminDomain:shop},pages:[],source:'shopify',syncedAt:null,warnings:[]},drafts:{},imageDrafts:{},mappings:{},gsc:[],snapshots:[],technical:null,backlinks:[],backlinksAuto:false,growth:{checks:{},done:{},outreach:{},reports:[]} };
}
export function assertAllowedShop(shop, allowed = process.env.ALLOWED_SHOP) {
  if (process.env.NODE_ENV === 'production' && !allowed) throw new Response('ALLOWED_SHOP konfiqurasiyası tələb olunur.',{status:503});
  if (allowed && allowed !== shop) throw new Response('Bu tətbiq yalnız No Sweat USA üçün nəzərdə tutulub.',{status:403});
}
export function adminClient(admin, shop) {
  const api = new Shopify({ SHOPIFY_STORE: shop });
  api.query = async (query, variables = {}) => {
    const response = await admin.graphql(query,{variables});
    const result = await response.json();
    if (!response.ok || result.errors?.length || !result.data) throw new Error('Shopify sorğusu alınmadı. Tətbiqin read_products / write_products icazələrini yoxlayın.');
    return result.data;
  };
  return api;
}
export async function ensureWorkspace(db, shop) {
  return db.seoWorkspace.upsert({where:{shop},update:{},create:{shop,data:JSON.stringify(initialWorkspace(shop))}});
}
export function dashboardData(workspace, changes = []) {
  const pages = audit(workspace.catalog.pages,workspace.mappings).map(p=>({...p,suggestion:suggestion(p,workspace.catalog.shop.name)}));
  const reports = [...workspace.gsc].sort((a,b)=>b.endDate.localeCompare(a.endDate)||b.importedAt.localeCompare(a.importedAt));
  const current = reports[0], prior = current && reports.find(r=>r.source===current.source && (r.country||'unknown')===(current.country||'unknown') && (r.device||'unknown')===(current.device||'unknown') && (r.searchType||'unknown')===(current.searchType||'unknown') && r.property===current.property && r.grain===current.grain && r.endDate<current.startDate && Date.parse(r.endDate)-Date.parse(r.startDate)===Date.parse(current.endDate)-Date.parse(current.startDate));
  return { growth:growthData(workspace,changes),backlinks:workspace.backlinks||[],backlinksAuto:workspace.backlinksAuto||false,opportunities:backlinkOpportunities(pages),catalog:{...workspace.catalog,pages},drafts:Object.values(workspace.drafts).map(d=>({...d,afterHash:fingerprint(d.after),stale:!pages.some(p=>p.id===d.pageId&&fingerprint(p.seo)===d.beforeHash)})),imageDrafts:Object.values(workspace.imageDrafts||{}),technical:workspace.technical||null,mappings:workspace.mappings,links:internalLinks(pages),gsc:summarizeGSC(current,prior),snapshots:workspace.snapshots,changes:changes.map(c=>({...c,before:JSON.parse(c.before),after:JSON.parse(c.after),createdAt:c.createdAt.toISOString()})) };
}
function snapshot(state) {
  const pages = audit(state.catalog.pages,state.mappings);
  state.snapshots.push({date:new Date().toISOString(),pageCount:pages.length,issues:pages.reduce((n,p)=>n+p.issues.length,0),score:pages.length?Math.round(pages.reduce((n,p)=>n+p.score,0)/pages.length):null});
  state.snapshots=state.snapshots.slice(-60);
}
function findPage(state,id) { const page=state.catalog.pages.find(p=>p.id===id);if(!page)throw new Error('Səhifə tapılmadı. Əvvəlcə kataloqu yeniləyin.');return page; }
export function saveDraft(state,input) {
  const page=findPage(state,input.pageId);
  if(typeof input.title!=='string'||typeof input.description!=='string'||!input.title.trim()||input.title.length>70||input.description.length>320)throw new Error('SEO başlığı 1–70, meta təsvir 0–320 simvol olmalıdır.');
  const old=state.drafts[page.id];
  state.drafts[page.id]={pageId:page.id,pageTitle:page.title,before:old?.before||cleanSEO(page.seo),beforeHash:old?.beforeHash||fingerprint(page.seo),after:{title:input.title.trim(),description:input.description.trim()},updatedAt:new Date().toISOString()};
}
export function validateGSC(input,domain) {
  const report=importGSC(input.csv,input);
  const expected=new URL(domain).hostname.replace(/^www\./,'');
  let host;try{host=report.property.startsWith('sc-domain:')?report.property.slice(10):new URL(report.property).hostname;}catch{throw new Error('Property ünvanı düzgün deyil.');}
  if(host.replace(/^www\./,'')!==expected)throw new Error('CSV property-si bu mağazaya aid deyil.');
  if(report.rows.some(r=>r.page&&new URL(r.page).hostname.replace(/^www\./,'')!==expected))throw new Error('CSV-də başqa domenə aid səhifə var.');
  return report;
}
export async function applyDraft({state,input,api,db,shop}) {
  if(input.confirm!=='APPLY')throw new Error('Canlı dəyişiklik təsdiqlənməyib.');
  const page=findPage(state,input.pageId),draft=state.drafts[page.id];
  if(!draft)throw new Error('Düzəliş layihəsi yoxdur.');
  // The browser confirms the exact draft revision it displayed, not just a page ID.
  if(input.draftHash!==fingerprint(draft.after))throw new Error('Layihə başqa pəncərədə dəyişib. Yeni mətni nəzərdən keçirib təsdiqləyin.');
  const current=await api.readSEO(page.id,page.type);
  if(fingerprint(current.seo)!==draft.beforeHash)throw new Error('Səhifə Shopify-da dəyişib. Kataloqu yeniləyin, köhnə layihəni silib yenisini hazırlayın.');
  const change=await db.seoChange.create({data:{shop,pageId:page.id,pageTitle:page.title,before:JSON.stringify(cleanSEO(current.seo)),after:JSON.stringify(draft.after),status:'attempted'}});
  try{
    const updated=await api.updateSEO(page,draft.after);
    if(fingerprint(updated.seo)!==fingerprint(draft.after))throw new Error('Shopify qaytardığı SEO dəyərləri layihədən fərqlidir.');
    await db.seoChange.update({where:{id:change.id},data:{status:'applied'}});
    page.seo=updated.seo;page.updatedAt=updated.updatedAt;delete state.drafts[page.id];snapshot(state);
  }catch(error){await db.seoChange.update({where:{id:change.id},data:{status:'unconfirmed'}});throw new Error(`${error.message} Nəticəni təsdiqləmək üçün kataloqu yeniləyin. Əvvəlki mətn tarixçədə saxlanılıb.`);}
}
export async function performOperation({db,shop,admin,input}) {
  await ensureWorkspace(db,shop);
  const lockToken=crypto.randomUUID();
  const acquired=await db.seoWorkspace.updateMany({where:{shop,OR:[{lockUntil:null},{lockUntil:{lt:new Date()}}]},data:{lockToken,lockUntil:new Date(Date.now()+10*60*1000)}});
  if(acquired.count!==1)throw new Error('Başqa əməliyyat davam edir. Bir az sonra təkrarlayın.');
  try{
    const row=await db.seoWorkspace.findUniqueOrThrow({where:{shop}});const state=JSON.parse(row.data);const api=adminClient(admin,shop);
    let message;
    switch(input.intent){
      case 'competitor-import':importCompetitor(state,input.json);message='Rəqib SEO hesabatı saxlanıldı.';break;
      case 'backlink-csv-import':importBacklinkCSV(state,input);message='Backlink CSV hesabatı saxlanıldı.';break;
      case 'growth-check':setReadiness(state,input);message='Məhsul yoxlaması saxlanıldı.';break;
      case 'growth-task':setTaskDone(state,input);message='Həftəlik tapşırıq yeniləndi.';break;
      case 'growth-outreach':saveOutreach(state,input);message='Əlaqə mətni layihə kimi saxlanıldı. Heç kimə göndərilməyib.';break;

      case 'google-sync':message=await syncGoogle(db,shop,state);break;
      case 'google-disconnect':message=await disconnectGoogle(db,shop);break;
      case 'google-settings':{
        const row=await db.googleConnection.findUnique({where:{shop}});
        if(!row||!JSON.parse(row.properties).includes(input.property))throw new Error('Google property-si bu bağlantıya aid deyil.');
        await db.googleConnection.update({where:{shop},data:{property:input.property,autoSync:input.autoSync==='true',syncedAt:null}});message='Google yeniləmə parametrləri saxlanıldı.';break;
      }
      case 'compression-prepare':message=await prepareCompression({db,shop,api,state,imageId:input.imageId});break;
      case 'compression-apply':message=await applyCompression({db,shop,api,id:input.id,afterHash:input.afterHash,confirm:input.confirm});break;
      case 'compression-check':message=await checkCompression({db,shop,api,id:input.id});break;
      case 'compression-delete':{
        if(input.confirm!=='DELETE')throw new Error('Nüsxənin silinməsi təsdiqlənməyib.');
        const row=await db.imageCompression.findFirst({where:{id:input.id,shop}});
        if(!row||['submitted','unconfirmed'].includes(row.status))throw new Error('Göndərilmiş faylın vəziyyətini əvvəlcə yoxlayın.');
        await db.imageCompression.delete({where:{id:row.id}});message='Sıxılma işi və yerli ehtiyat nüsxə silindi.';break;
      }
      case 'backlink-add':addBacklink(state,input);message='Backlink mənbəyi siyahıya əlavə edildi.';break;
      case 'backlink-delete':state.backlinks=(state.backlinks||[]).filter(r=>r.id!==input.id);message='Mənbə siyahıdan silindi.';break;
      case 'backlink-check':message=await checkBacklinks(state);break;
      case 'backlink-auto':state.backlinksAuto=input.enabled==='true';message='Backlink yeniləmə parametri saxlanıldı.';break;

      case 'sync':{
        const catalog=await api.catalog();
        if(new URL(catalog.shop.domain).hostname.replace(/^www\./,'')!=='nosweatusa.com')throw new Error('Bu tətbiq No Sweat USA kataloqu üçün hazırlanıb.');
        state.catalog=catalog;snapshot(state);message=`${catalog.pages.length} səhifə Shopify-dan gətirildi.`;break;
      }
      case 'save-draft':saveDraft(state,input);message='Layihə saxlanıldı. Canlı mağaza dəyişməyib.';break;
      case 'bulk-draft':{
        const ids=JSON.parse(input.pageIds||'[]');if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>typeof id!=='string'))throw new Error('1–100 səhifə seçin.');
        let created=0;for(const id of new Set(ids)){if(state.drafts[id])continue;const p=findPage(state,id);const proposed=suggestion(p,state.catalog.shop.name);saveDraft(state,{pageId:id,...proposed});created++;}
        message=`${created} layihə hazırlandı. Mövcud layihələr qorundu; canlı səhifələr dəyişməyib.`;break;
      }
      case 'technical':{
        if(!state.catalog.pages.length)throw new Error('Əvvəlcə kataloqu gətirin.');
        state.technical=await technicalAudit(state.catalog.pages);message='Texniki səhifə və daxili link yoxlaması tamamlandı.';break;
      }
      case 'restore-draft':{
        const change=await db.seoChange.findFirst({where:{id:input.changeId,shop,status:'applied'}});if(!change)throw new Error('Dəyişiklik tapılmadı.');
        if(change.pageId.startsWith('gid://shopify/MediaImage/'))throw new Error('Şəkil alt mətnini Şəkillər bölməsində əvvəlki dəyərlə layihə kimi hazırlayın.');
        const p=findPage(state,change.pageId);if(state.drafts[p.id])throw new Error('Bu səhifənin mövcud layihəsini əvvəlcə nəzərdən keçirin və ya silin.');
        const current=await api.readSEO(p.id,p.type);if(fingerprint(current.seo)!==fingerprint(JSON.parse(change.after)))throw new Error('Shopify mətni bu dəyişiklikdən sonra yenilənib. Əvvəlki mətni əl ilə müqayisə edin.');
        p.seo=current.seo;state.drafts[p.id]={pageId:p.id,pageTitle:p.title,before:cleanSEO(current.seo),beforeHash:fingerprint(current.seo),after:cleanSEO(JSON.parse(change.before)),updatedAt:new Date().toISOString()};message='Əvvəlki mətn geri dönüş layihəsi kimi hazırlandı. Tətbiqdən əvvəl nəzərdən keçirin.';break;
      }
      case 'image-draft':{
        const image=state.catalog.pages.flatMap(p=>p.images||[]).find(im=>im.id===input.imageId);if(!image)throw new Error('Məhsul şəkli tapılmadı.');
        if(typeof input.alt!=='string'||input.alt.length>512)throw new Error('Alt mətn 512 simvoldan uzun olmamalıdır.');
        state.imageDrafts ||= {};const old=state.imageDrafts[image.id];state.imageDrafts[image.id]={imageId:image.id,url:image.url,before:old?.before??image.altText??'',after:input.alt.trim()};
        message='Şəkil alt mətni layihəsi saxlanıldı.';break;
      }
      case 'image-delete':delete state.imageDrafts?.[input.imageId];message='Şəkil layihəsi silindi.';break;
      case 'image-apply':{
        if(input.confirm!=='APPLY')throw new Error('Şəkil dəyişikliyi təsdiqlənməyib.');
        const draft=state.imageDrafts?.[input.imageId];if(!draft||input.alt!==draft.after)throw new Error('Şəkil layihəsi dəyişib. Yeni mətni yoxlayın.');
        const current=(await api.query('query ImageAlt($id: ID!) { node(id: $id) { ... on MediaImage { id alt } } }',{id:draft.imageId})).node;
        if(!current||(current.alt||'')!==draft.before)throw new Error('Şəkil Shopify-da dəyişib. Kataloqu yeniləyib layihəni yenidən hazırlayın.');
        const change=await db.seoChange.create({data:{shop,pageId:draft.imageId,pageTitle:'Şəkil alt mətni',before:JSON.stringify({title:'Alt mətn',description:draft.before}),after:JSON.stringify({title:'Alt mətn',description:draft.after}),status:'attempted'}});
        try{
          const payload=(await api.query('mutation UpdateImageAlt($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { files { id alt } userErrors { field message } } }',{files:[{id:draft.imageId,alt:draft.after}]})).fileUpdate;
          if(payload.userErrors?.length||!payload.files?.some(f=>f.id===draft.imageId&&(f.alt||'')===draft.after))throw new Error('Shopify şəkil yeniləməsini təsdiqləmədi. write_files icazəsini yoxlayın.');
          await db.seoChange.update({where:{id:change.id},data:{status:'applied'}});
          for(const p of state.catalog.pages)for(const im of p.images||[])if(im.id===draft.imageId)im.altText=draft.after;
          delete state.imageDrafts[draft.imageId];snapshot(state);message='Şəkil alt mətni Shopify-da yeniləndi.';
        }catch(error){await db.seoChange.update({where:{id:change.id},data:{status:'unconfirmed'}});throw error;}
        break;
      }
      case 'delete-draft':delete state.drafts[input.pageId];message='Layihə silindi.';break;
      case 'keyword':{
        findPage(state,input.pageId);if(typeof input.keyword!=='string'||input.keyword.length>150)throw new Error('Hədəf ifadə 150 simvoldan uzun olmamalıdır.');
        state.mappings[input.pageId]=input.keyword.trim();message='Hədəf ifadə saxlanıldı.';break;
      }
      case 'gsc-import':{
        const report=validateGSC(input,state.catalog.shop.domain);
        state.gsc=state.gsc.filter(r=>!(r.startDate===report.startDate&&r.endDate===report.endDate&&r.property===report.property&&r.grain===report.grain));state.gsc.push(report);state.gsc=state.gsc.slice(-24);
        message=`${report.rows.length} Search Console sətri idxal edildi.`;break;
      }
      case 'apply':await applyDraft({state,input,api,db,shop});message='SEO başlığı və təsviri Shopify-da yeniləndi.';break;
      case 'bulk-apply':{
        if(input.confirm!=='APPLY')throw new Error('Toplu dəyişiklik təsdiqlənməyib.');
        const batch=JSON.parse(input.batch||'[]');
        if(!Array.isArray(batch)||!batch.length||batch.length>25||batch.some(d=>typeof d.pageId!=='string'||typeof d.draftHash!=='string')||new Set(batch.map(d=>d.pageId)).size!==batch.length)throw new Error('1–25 unikal layihə seçin.');
        let applied=0,failure='';
        for(const entry of batch){try{await applyDraft({state,input:{...entry,confirm:'APPLY'},api,db,shop});applied++;}catch(error){failure=error.message;break;}}
        message=`${applied}/${batch.length} layihə tətbiq edildi.${failure?` Qalanları dayandırıldı: ${failure}`:''}`;break;
      }
      default:throw new Error('Əməliyyat tapılmadı.');
    }
    const saved=await db.seoWorkspace.updateMany({where:{shop,lockToken,revision:row.revision},data:{data:JSON.stringify(state),revision:{increment:1}}});
    if(saved.count!==1)throw new Error('Məlumat başqa əməliyyatda dəyişib. Kataloqu yeniləyin.');
    return {ok:true,message};
  }finally{await db.seoWorkspace.updateMany({where:{shop,lockToken},data:{lockToken:null,lockUntil:null}});}
}
export function exportAudit(state) {
  const rows=[['Page','URL','Type','Checklist score','Priority','Issue','Detail']];
  for(const p of audit(state.catalog.pages,state.mappings))for(const issue of p.issues)rows.push([p.title,p.url,p.type,p.score,issue.severity,issue.label,issue.detail]);
  return encodeCSV(rows);
}
