import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAuditConfig,auditURL,robotsAllows} from '../app/lib/audit-config.mjs';
import {advancedAudit} from '../app/lib/seo-audit.server.mjs';
const base='https://nosweatusa.com/';
test('audit rules validate scope, normalize parameters and keep deny priority',()=>{
 const c=validateAuditConfig({allow:'/products/',disallow:'/products/private*',removeAllParams:false});assert.equal(auditURL('/products/a?utm_source=x&variant=2&gclid=x',base,c),base+'products/a?variant=2');assert.equal(auditURL('/products/private-a',base,c),null);assert.equal(auditURL('https://evil.test/products/a',base,c),null);assert.equal(auditURL('/admin',base,c),null);assert.throws(()=>validateAuditConfig({maxPages:10000}));assert.throws(()=>validateAuditConfig({source:'urls',urls:'https://evil.test/'}));
});
test('robots group matching, wildcards and allow exceptions',()=>{
 const txt='User-agent: *\nDisallow: /products/\nAllow: /products/open$\nUser-agent: OtherBot\nDisallow: /';assert(!robotsAllows(txt,base+'products/a'));assert(robotsAllows(txt,base+'products/open'));assert(!robotsAllows(txt,base+'products/open-x'));assert(robotsAllows('User-agent: NoSweatSEO\nAllow: /\nUser-agent: *\nDisallow: /',base));
});
test('crawler enforces rules on redirects and discovers duplicates and orphan candidates',async()=>{
 const fetched=[];const text='<main>'+('same product content '.repeat(15))+'</main>';
 const fetcher=async value=>{const u=String(value);fetched.push(u);if(u.endsWith('robots.txt'))return new Response('User-agent: *\nDisallow: /products/blocked');if(u.endsWith('sitemap.xml'))return new Response('<urlset><loc>'+base+'products/orphan</loc><loc>'+base+'products/blocked</loc></urlset>');if(u.endsWith('/products/redirect'))return new Response(null,{status:302,headers:{location:'/products/blocked'}});return new Response('<title>Same</title><h1>Hello</h1>'+text);};
 const r=await advancedAudit([{url:base+'products/a'},{url:base+'products/redirect'}],fetcher,{maxPages:10,delayMs:0});assert(!fetched.includes(base+'products/blocked'));assert(r.findings.some(f=>f.type==='Aynı başlık'));assert(r.findings.some(f=>f.type==='Aynı metin'));assert(r.findings.some(f=>f.type==='Bağlantısız sayfa adayı'));assert(r.pages.find(p=>p.url.endsWith('/redirect')).status===null);
});
test('URL-list mode stays within list; robots override and nofollow settings actually change crawl',async()=>{
 const fetcher=async value=>String(value).endsWith('robots.txt')?new Response('User-agent: *\nDisallow: /products/a'):new Response('<h1>A</h1><a rel="nofollow" href="/products/b">B</a>');
 const a=await advancedAudit([],fetcher,{source:'urls',urls:base+'products/a',delayMs:0,ignoreRobots:true});assert.equal(a.pages.length,1);
 const b=await advancedAudit([{url:base+'products/a'}],fetcher,{source:'site',maxPages:10,delayMs:0,ignoreRobots:true,followNofollow:true});assert(b.pages.some(p=>p.url.endsWith('/products/b')));
});
