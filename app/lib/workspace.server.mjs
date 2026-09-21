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
  if (process.env.NODE_ENV === 'production' && !allowed) throw new Response("ALLOWED_SHOP yapılandırması gereklidir.",{status:503});
  if (allowed && allowed !== shop) throw new Response("Bu uygulama yalnızca No Sweat USA için tasarlanmıştır.",{status:403});
}
export function adminClient(admin, shop) {
  const api = new Shopify({ SHOPIFY_STORE: shop });
  api.query = async (query, variables = {}) => {
    const response = await admin.graphql(query,{variables});
    const result = await response.json();
    if (!response.ok || result.errors?.length || !result.data) throw new Error("Shopify isteği başarısız oldu. Uygulamanın read_products / write_products izinlerini kontrol edin.");
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
  return { googleDays:workspace.googleDays||28,googleReports:[...workspace.gsc,...(workspace.growth?.reports||[])].filter(r=>r.source==='google-api'),growth:growthData(workspace,changes),backlinks:workspace.backlinks||[],backlinksAuto:workspace.backlinksAuto||false,opportunities:backlinkOpportunities(pages),catalog:{...workspace.catalog,pages},drafts:Object.values(workspace.drafts).map(d=>({...d,afterHash:fingerprint(d.after),stale:!pages.some(p=>p.id===d.pageId&&fingerprint(p.seo)===d.beforeHash)})),imageDrafts:Object.values(workspace.imageDrafts||{}),technical:workspace.technical||null,mappings:workspace.mappings,links:internalLinks(pages),gsc:summarizeGSC(current,prior),snapshots:workspace.snapshots,changes:changes.map(c=>({...c,before:JSON.parse(c.before),after:JSON.parse(c.after),createdAt:c.createdAt.toISOString()})) };
}
function snapshot(state) {
  const pages = audit(state.catalog.pages,state.mappings);
  state.snapshots.push({date:new Date().toISOString(),pageCount:pages.length,issues:pages.reduce((n,p)=>n+p.issues.length,0),score:pages.length?Math.round(pages.reduce((n,p)=>n+p.score,0)/pages.length):null});
  state.snapshots=state.snapshots.slice(-60);
}
function findPage(state,id) { const page=state.catalog.pages.find(p=>p.id===id);if(!page)throw new Error("Sayfa bulunamadı. Önce kataloğu güncelleyin.");return page; }
export function saveDraft(state,input) {
  const page=findPage(state,input.pageId);
  if(typeof input.title!=='string'||typeof input.description!=='string'||!input.title.trim()||input.title.length>70||input.description.length>320)throw new Error("SEO başlığı 1–70, meta açıklama 0–320 karakter olmalıdır.");
  const old=state.drafts[page.id];
  state.drafts[page.id]={pageId:page.id,pageTitle:page.title,before:old?.before||cleanSEO(page.seo),beforeHash:old?.beforeHash||fingerprint(page.seo),after:{title:input.title.trim(),description:input.description.trim()},updatedAt:new Date().toISOString()};
}
export function validateGSC(input,domain) {
  const report=importGSC(input.csv,input);
  const expected=new URL(domain).hostname.replace(/^www\./,'');
  let host;try{host=report.property.startsWith('sc-domain:')?report.property.slice(10):new URL(report.property).hostname;}catch{throw new Error("Mülk adresi geçerli değil.");}
  if(host.replace(/^www\./,'')!==expected)throw new Error("CSV mülkü bu mağazaya ait değil.");
  if(report.rows.some(r=>r.page&&new URL(r.page).hostname.replace(/^www\./,'')!==expected))throw new Error("CSV dosyasında başka alan adına ait bir sayfa var.");
  return report;
}
export async function applyDraft({state,input,api,db,shop}) {
  if(input.confirm!=='APPLY')throw new Error("Canlı değişiklik onaylanmadı.");
  const page=findPage(state,input.pageId),draft=state.drafts[page.id];
  if(!draft)throw new Error("Düzenleme taslağı yok.");
  // The browser confirms the exact draft revision it displayed, not just a page ID.
  if(input.draftHash!==fingerprint(draft.after))throw new Error("Taslak başka bir pencerede değişti. Yeni metni inceleyip onaylayın.");
  const current=await api.readSEO(page.id,page.type);
  if(fingerprint(current.seo)!==draft.beforeHash)throw new Error("Sayfa Shopify’da değişti. Kataloğu güncelleyin, eski taslağı silip yenisini hazırlayın.");
  const change=await db.seoChange.create({data:{shop,pageId:page.id,pageTitle:page.title,before:JSON.stringify(cleanSEO(current.seo)),after:JSON.stringify(draft.after),status:'attempted'}});
  try{
    const updated=await api.updateSEO(page,draft.after);
    if(fingerprint(updated.seo)!==fingerprint(draft.after))throw new Error("Shopify’ın döndürdüğü SEO değerleri taslaktan farklı.");
    await db.seoChange.update({where:{id:change.id},data:{status:'applied'}});
    page.seo=updated.seo;page.updatedAt=updated.updatedAt;delete state.drafts[page.id];snapshot(state);
  }catch(error){await db.seoChange.update({where:{id:change.id},data:{status:'unconfirmed'}});throw new Error(`${error.message} Sonucu doğrulamak için kataloğu güncelleyin. Önceki metin geçmişte saklandı.`);}
}
export async function performOperation({db,shop,admin,input}) {
  await ensureWorkspace(db,shop);
  const lockToken=crypto.randomUUID();
  const acquired=await db.seoWorkspace.updateMany({where:{shop,OR:[{lockUntil:null},{lockUntil:{lt:new Date()}}]},data:{lockToken,lockUntil:new Date(Date.now()+10*60*1000)}});
  if(acquired.count!==1)throw new Error("Başka bir işlem devam ediyor. Biraz sonra tekrarlayın.");
  try{
    const row=await db.seoWorkspace.findUniqueOrThrow({where:{shop}});const state=JSON.parse(row.data);const api=adminClient(admin,shop);
    let message;
    switch(input.intent){
      case 'competitor-import':importCompetitor(state,input.json);message="Rakip SEO raporu kaydedildi.";break;
      case 'backlink-csv-import':importBacklinkCSV(state,input);message="Backlink CSV raporu kaydedildi.";break;
      case 'growth-check':setReadiness(state,input);message="Ürün kontrolü kaydedildi.";break;
      case 'growth-task':setTaskDone(state,input);message="Haftalık görev güncellendi.";break;
      case 'growth-outreach':saveOutreach(state,input);message="İletişim metni taslak olarak kaydedildi. Kimseye gönderilmedi.";break;

      case 'google-sync':message=await syncGoogle(db,shop,state,undefined,input.days===undefined?(state.googleDays||28):Number(input.days));break;
      case 'google-disconnect':message=await disconnectGoogle(db,shop);break;
      case 'google-settings':{
        const row=await db.googleConnection.findUnique({where:{shop}});
        if(!row||!JSON.parse(row.properties).includes(input.property))throw new Error("Google mülkü bu bağlantıya ait değil.");
        await db.googleConnection.update({where:{shop},data:{property:input.property,autoSync:input.autoSync==='true',syncedAt:null}});message="Google güncelleme ayarları kaydedildi.";break;
      }
      case 'compression-prepare':message=await prepareCompression({db,shop,api,state,imageId:input.imageId});break;
      case 'compression-apply':message=await applyCompression({db,shop,api,id:input.id,afterHash:input.afterHash,confirm:input.confirm});break;
      case 'compression-check':message=await checkCompression({db,shop,api,id:input.id});break;
      case 'compression-delete':{
        if(input.confirm!=='DELETE')throw new Error("Kopyanın silinmesi onaylanmadı.");
        const row=await db.imageCompression.findFirst({where:{id:input.id,shop}});
        if(!row||['submitted','unconfirmed'].includes(row.status))throw new Error("Önce gönderilen dosyanın durumunu kontrol edin.");
        await db.imageCompression.delete({where:{id:row.id}});message="Sıkıştırma işlemi ve yerel yedek silindi.";break;
      }
      case 'backlink-add':addBacklink(state,input);message="Backlink kaynağı listeye eklendi.";break;
      case 'backlink-delete':state.backlinks=(state.backlinks||[]).filter(r=>r.id!==input.id);message="Kaynak listeden kaldırıldı.";break;
      case 'backlink-check':message=await checkBacklinks(state);break;
      case 'backlink-auto':state.backlinksAuto=input.enabled==='true';message="Backlink güncelleme ayarı kaydedildi.";break;

      case 'sync':{
        const catalog=await api.catalog();
        if(new URL(catalog.shop.domain).hostname.replace(/^www\./,'')!=='nosweatusa.com')throw new Error("Bu uygulama No Sweat USA kataloğu için hazırlandı.");
        state.catalog=catalog;snapshot(state);message=`${catalog.pages.length} sayfa Shopify’dan getirildi.`;break;
      }
      case 'save-draft':saveDraft(state,input);message="Taslak kaydedildi. Canlı mağaza değişmedi.";break;
      case 'bulk-draft':{
        const ids=JSON.parse(input.pageIds||'[]');if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>typeof id!=='string'))throw new Error("1–100 sayfa seçin.");
        let created=0;for(const id of new Set(ids)){if(state.drafts[id])continue;const p=findPage(state,id);const proposed=suggestion(p,state.catalog.shop.name);saveDraft(state,{pageId:id,...proposed});created++;}
        message=`${created} taslak hazırlandı. Mevcut taslaklar korundu; canlı sayfalar değişmedi.`;break;
      }
      case 'technical':{
        if(!state.catalog.pages.length)throw new Error("Önce kataloğu getirin.");
        state.technical=await technicalAudit(state.catalog.pages);message="Teknik sayfa ve dahili bağlantı kontrolü tamamlandı.";break;
      }
      case 'restore-draft':{
        const change=await db.seoChange.findFirst({where:{id:input.changeId,shop,status:'applied'}});if(!change)throw new Error("Değişiklik bulunamadı.");
        if(change.pageId.startsWith('gid://shopify/MediaImage/'))throw new Error("Görsel alt metnini Görseller bölümünde önceki değerle taslak olarak hazırlayın.");
        const p=findPage(state,change.pageId);if(state.drafts[p.id])throw new Error("Önce bu sayfanın mevcut taslağını inceleyin veya silin.");
        const current=await api.readSEO(p.id,p.type);if(fingerprint(current.seo)!==fingerprint(JSON.parse(change.after)))throw new Error("Shopify metni bu değişiklikten sonra güncellendi. Önceki metni elle karşılaştırın.");
        p.seo=current.seo;state.drafts[p.id]={pageId:p.id,pageTitle:p.title,before:cleanSEO(current.seo),beforeHash:fingerprint(current.seo),after:cleanSEO(JSON.parse(change.before)),updatedAt:new Date().toISOString()};message="Önceki metin geri dönüş taslağı olarak hazırlandı. Uygulamadan önce inceleyin.";break;
      }
      case 'image-draft':{
        const image=state.catalog.pages.flatMap(p=>p.images||[]).find(im=>im.id===input.imageId);if(!image)throw new Error("Ürün görseli bulunamadı.");
        if(typeof input.alt!=='string'||input.alt.length>512)throw new Error("Alt metin 512 karakterden uzun olmamalıdır.");
        state.imageDrafts ||= {};const old=state.imageDrafts[image.id];state.imageDrafts[image.id]={imageId:image.id,url:image.url,before:old?.before??image.altText??'',after:input.alt.trim()};
        message="Görsel alt metni taslağı kaydedildi.";break;
      }
      case 'image-delete':delete state.imageDrafts?.[input.imageId];message="Görsel taslağı silindi.";break;
      case 'image-apply':{
        if(input.confirm!=='APPLY')throw new Error("Görsel değişikliği onaylanmadı.");
        const draft=state.imageDrafts?.[input.imageId];if(!draft||input.alt!==draft.after)throw new Error("Görsel taslağı değişti. Yeni metni kontrol edin.");
        const current=(await api.query('query ImageAlt($id: ID!) { node(id: $id) { ... on MediaImage { id alt } } }',{id:draft.imageId})).node;
        if(!current||(current.alt||'')!==draft.before)throw new Error("Görsel Shopify’da değişti. Kataloğu güncelleyip taslağı yeniden hazırlayın.");
        const change=await db.seoChange.create({data:{shop,pageId:draft.imageId,pageTitle:"Görsel alt metni",before:JSON.stringify({title:"Alt metin",description:draft.before}),after:JSON.stringify({title:"Alt metin",description:draft.after}),status:'attempted'}});
        try{
          const payload=(await api.query('mutation UpdateImageAlt($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { files { id alt } userErrors { field message } } }',{files:[{id:draft.imageId,alt:draft.after}]})).fileUpdate;
          if(payload.userErrors?.length||!payload.files?.some(f=>f.id===draft.imageId&&(f.alt||'')===draft.after))throw new Error("Shopify görsel güncellemesini doğrulamadı. write_files iznini kontrol edin.");
          await db.seoChange.update({where:{id:change.id},data:{status:'applied'}});
          for(const p of state.catalog.pages)for(const im of p.images||[])if(im.id===draft.imageId)im.altText=draft.after;
          delete state.imageDrafts[draft.imageId];snapshot(state);message="Görsel alt metni Shopify’da güncellendi.";
        }catch(error){await db.seoChange.update({where:{id:change.id},data:{status:'unconfirmed'}});throw error;}
        break;
      }
      case 'delete-draft':delete state.drafts[input.pageId];message="Taslak silindi.";break;
      case 'keyword':{
        findPage(state,input.pageId);if(typeof input.keyword!=='string'||input.keyword.length>150)throw new Error("Hedef ifade 150 karakterden uzun olmamalıdır.");
        state.mappings[input.pageId]=input.keyword.trim();message="Hedef ifade kaydedildi.";break;
      }
      case 'gsc-import':{
        const report=validateGSC(input,state.catalog.shop.domain);
        state.gsc=state.gsc.filter(r=>!(r.startDate===report.startDate&&r.endDate===report.endDate&&r.property===report.property&&r.grain===report.grain));state.gsc.push(report);state.gsc=state.gsc.slice(-24);
        message=`${report.rows.length} Search Console satırı içe aktarıldı.`;break;
      }
      case 'apply':await applyDraft({state,input,api,db,shop});message="SEO başlığı ve açıklaması Shopify’da güncellendi.";break;
      case 'bulk-apply':{
        if(input.confirm!=='APPLY')throw new Error("Toplu değişiklik onaylanmadı.");
        const batch=JSON.parse(input.batch||'[]');
        if(!Array.isArray(batch)||!batch.length||batch.length>25||batch.some(d=>typeof d.pageId!=='string'||typeof d.draftHash!=='string')||new Set(batch.map(d=>d.pageId)).size!==batch.length)throw new Error("1–25 benzersiz taslak seçin.");
        let applied=0,failure='';
        for(const entry of batch){try{await applyDraft({state,input:{...entry,confirm:'APPLY'},api,db,shop});applied++;}catch(error){failure=error.message;break;}}
        message=`${applied}/${batch.length} taslak uygulandı.${failure?` Kalanlar durduruldu: ${failure}`:''}`;break;
      }
      default:throw new Error("İşlem bulunamadı.");
    }
    const saved=await db.seoWorkspace.updateMany({where:{shop,lockToken,revision:row.revision},data:{data:JSON.stringify(state),revision:{increment:1}}});
    if(saved.count!==1)throw new Error("Veriler başka bir işlemde değişti. Kataloğu güncelleyin.");
    return {ok:true,message};
  }finally{await db.seoWorkspace.updateMany({where:{shop,lockToken},data:{lockToken:null,lockUntil:null}});}
}
export function exportAudit(state) {
  const rows=[['Page','URL','Type','Checklist score','Priority','Issue','Detail']];
  for(const p of audit(state.catalog.pages,state.mappings))for(const issue of p.issues)rows.push([p.title,p.url,p.type,p.score,issue.severity,issue.label,issue.detail]);
  return encodeCSV(rows);
}
