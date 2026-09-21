import sharp from 'sharp';
import {assetURL,hash,key} from './secrets.server.mjs';
import {publicFetch} from './public-fetch.server.mjs';
sharp.concurrency(2);
export const IMAGE_SOURCE_QUERY='query CompressionSource($id: ID!) { node(id: $id) { ... on MediaImage { id fileStatus updatedAt originalSource { url } } } }';
export const IMAGE_REPLACE_MUTATION='mutation CompressImage($files: [FileUpdateInput!]!) { fileUpdate(files: $files) { files { id fileStatus updatedAt } userErrors { field message } } }';
export async function optimizeImage(bytes){
 const metadata=await sharp(bytes,{limitInputPixels:40000000}).metadata();
 if((metadata.pages||1)>1||!['jpeg','png','webp'].includes(metadata.format))throw new Error("Yalnızca animasyonsuz JPEG, PNG ve WebP sıkıştırılabilir.");
 let image=sharp(bytes,{limitInputPixels:40000000}).rotate().keepIccProfile();
 if(metadata.format==='jpeg')image=image.jpeg({quality:82,mozjpeg:true});
 if(metadata.format==='png')image=image.png({compressionLevel:9});
 if(metadata.format==='webp')image=image.webp({quality:82,alphaQuality:100});
 const optimized=await image.toBuffer();if(optimized.length>=bytes.length)throw new Error("Bu görsel için daha küçük bir dosya oluşturulamadı. Orijinal korundu.");
 return {optimized,mime:`image/${metadata.format}`,beforeHash:hash(bytes),afterHash:hash(optimized)};
}
async function source(api,imageId){const node=(await api.query(IMAGE_SOURCE_QUERY,{id:imageId})).node;if(!node?.originalSource?.url||node.fileStatus!=='READY')throw new Error("Görselin orijinali hazır değil. Daha sonra tekrar kontrol edin.");return node;}
async function download(url){const r=await publicFetch(url,{maxBytes:20000000,allowedHost:host=>host==='cdn.shopify.com'||host.endsWith('.shopifycdn.com')||host==='shopifycdn.com'});if(r.status!==200)throw new Error("Shopify görseli yüklenemedi.");return r.bytes;}
export async function compressionList(db,shop){
 // length() supports SQLite blobs and PostgreSQL bytea; don't fetch all image bytes.
 const rows=await db.$queryRaw`SELECT "id", "imageId", "status", "afterHash", length("original") AS "beforeBytes", length("optimized") AS "afterBytes" FROM "ImageCompression" WHERE "shop" = ${shop} ORDER BY "createdAt" DESC`;
 return rows.map(r=>({...r,beforeBytes:Number(r.beforeBytes),afterBytes:Number(r.afterBytes),originalURL:assetURL(r.id,'original'),optimizedURL:assetURL(r.id,'optimized')}));
}
export async function prepareCompression({db,shop,api,state,imageId,downloader=download}){
 key();if(!state.catalog.pages.some(p=>(p.images||[]).some(i=>i.id===imageId)))throw new Error("Görsel bu kataloğa ait değil.");
 if(await db.imageCompression.count({where:{shop}})>=10)throw new Error("10 kopya sınırına ulaşıldı. Orijinalleri indirip eski kopyaları silin.");
 if(await db.imageCompression.findFirst({where:{shop,imageId,status:{in:['draft','submitted','unconfirmed']}}}))throw new Error("Bu görselin mevcut işlemini tamamlayın veya silin.");
 const current=await source(api,imageId),original=await downloader(current.originalSource.url),result=await optimizeImage(original);
 await db.imageCompression.create({data:{shop,imageId,original,...result,beforeUpdatedAt:current.updatedAt,status:'draft'}});
 return "Sıkıştırılmış önizleme hazır. Kaliteyi karşılaştırıp onaylayın.";
}
export async function applyCompression({db,shop,api,id,afterHash,confirm,downloader=download}){
 const row=await db.imageCompression.findFirst({where:{id,shop,status:'draft'}});if(!row||confirm!=='APPLY'||afterHash!==row.afterHash)throw new Error("Sıkıştırma taslağını yeniden inceleyip onaylayın.");
 const current=await source(api,row.imageId);if(hash(await downloader(current.originalSource.url))!==row.beforeHash)throw new Error("Görselin orijinali Shopify’da değişti. Yeni bir sıkıştırma taslağı hazırlayın.");
 // Persist an uncertain state before calling Shopify: timeouts must never trigger blind retries.
 await db.imageCompression.update({where:{id},data:{status:'unconfirmed',beforeUpdatedAt:current.updatedAt}});
 const payload=(await api.query(IMAGE_REPLACE_MUTATION,{files:[{id:row.imageId,originalSource:assetURL(id,'optimized')}]})).fileUpdate;
 if(payload.userErrors?.length||!payload.files?.some(f=>f.id===row.imageId))throw new Error("Shopify güncellemeyi kabul etmedi. Orijinal kopya saklandı; sonucu kontrol edin.");
 await db.imageCompression.update({where:{id},data:{status:'submitted'}});
 return "Shopify, sıkıştırılmış dosyayı işlemek üzere kabul etti. Tamamlanma durumunu ayrıca kontrol edin.";
}
export async function checkCompression({db,shop,api,id,downloader=download}){
 const row=await db.imageCompression.findFirst({where:{id,shop}});if(!row)throw new Error("Sıkıştırma işlemi bulunamadı.");
 if(!['submitted','unconfirmed','ready'].includes(row.status))return "Önce sıkıştırmayı uygulayın.";
 const node=(await api.query(IMAGE_SOURCE_QUERY,{id:row.imageId})).node;
 if(node?.fileStatus==='FAILED'){await db.imageCompression.update({where:{id},data:{status:'failed'}});return "Shopify, dosya işlenirken hata bildirdi. Orijinali yedekten indirebilirsiniz.";}
 if(node?.fileStatus!=='READY'||!node.originalSource?.url)return "Shopify dosyayı hâlâ işliyor.";
 const currentHash=hash(await downloader(node.originalSource.url));
 if(currentHash===row.afterHash){await db.imageCompression.update({where:{id},data:{status:'ready'}});return "Sıkıştırılmış orijinal Shopify’da doğrulandı. Kataloğu güncelleyin.";}
 if(currentHash===row.beforeHash)return "Orijinal henüz değişmedi. Biraz sonra durumu tekrar kontrol edin.";
 return "Shopify dosyası hazır ancak baytları taslaktan farklı. Başka bir değişiklik veya yeniden kodlama yapılmış olabilir; görseli Shopify’da kontrol edin.";
}
