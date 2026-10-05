import {GoogleAuth, OAuth2Client} from 'google-auth-library';
import {fetchGoogleReport, ownProperty} from './google.server.mjs';
import {appOrigin, seal, unseal} from './secrets.server.mjs';

const scope='https://www.googleapis.com/auth/webmasters.readonly';
function oauthClient(){return new OAuth2Client(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,`${appOrigin()}/google/callback`);}
async function serviceClient(){
 const encoded=process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
 if(!encoded)return null;
 let credentials;
 try{credentials=JSON.parse(Buffer.from(encoded,'base64').toString('utf8'));}catch{throw new Error('Google hizmet hesabı anahtarı geçersiz.');}
 if(credentials?.type!=='service_account'||!credentials.client_email?.endsWith('.iam.gserviceaccount.com')||!credentials.private_key?.includes('BEGIN PRIVATE KEY'))throw new Error('Google hizmet hesabı anahtarı eksik.');
 return new GoogleAuth({credentials,scopes:[scope]}).getClient();
}

// Calendar-week exports are isolated from the interactive 7/28/90-day selection.
export async function fetchWeeklyGoogle(db,shop,window,oauthFactory=oauthClient){
 const row=await db.googleConnection.findUnique({where:{shop}});
 if(!row?.property||!ownProperty(row.property))throw new Error('Haftalık rapor için önce Google hesabını bağlayın.');
 const service=await serviceClient(),oauth=service||oauthFactory();
 if(!service)oauth.setCredentials(unseal(row.tokens,shop));
 const reports=[];
 try{
  await oauth.getAccessToken();
  for(const country of [null,'usa'])for(const [start,end] of [[window.start,window.end],[window.previousStart,window.previousEnd]]){
   const [total,pages]=await Promise.all([
    fetchGoogleReport(oauth,row.property,start,end,{country,dimensions:[],maxRows:1}),
    fetchGoogleReport(oauth,row.property,start,end,{country,dimensions:['page'],maxRows:10000}),
   ]);
   total.truncated=false;reports.push(total,pages);
  }
  const dailyStart=new Date(`${window.end}T00:00:00Z`);dailyStart.setUTCDate(dailyStart.getUTCDate()-41);
  reports.push(await fetchGoogleReport(oauth,row.property,dailyStart.toISOString().slice(0,10),window.end,{country:'usa',dimensions:['page','date'],maxRows:10000}));
 }catch{throw new Error('Haftalık Google raporu alınamadı. Google bağlantısını kontrol edip yeniden deneyin.');}
 const saved=await db.googleConnection.updateMany({where:{shop,tokens:row.tokens},data:service?{property:row.property}:{tokens:seal(oauth.credentials,shop)}});
 if(!saved.count)throw new Error('Google bağlantısı değişti; raporu yeniden oluşturun.');
 return reports;
}
