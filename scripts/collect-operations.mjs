import {mkdir,writeFile} from 'node:fs/promises';
import {Shopify} from '../app/lib/core/shopify.mjs';
const {IMAGE_SOURCE_QUERY,IMAGE_REPLACE_MUTATION}=await import('../app/lib/compression.server.mjs');
const api=new Shopify({SHOPIFY_STORE:'test.myshopify.com'}),queries=[];
api.query=async(q)=>{queries.push(q);if(q.includes('shop {'))return{shop:{name:'Test',primaryDomain:{url:'https://nosweatusa.com'},myshopifyDomain:'test.myshopify.com'}};if(q.includes('products(first:'))return{products:{nodes:[],pageInfo:{hasNextPage:false}}};if(q.includes('collections(first:'))return{collections:{nodes:[],pageInfo:{hasNextPage:false}}};if(q.includes('query Current'))return{node:{id:'test'}};return q.includes('productUpdate')?{productUpdate:{product:{id:'test'}}}:{collectionUpdate:{collection:{id:'test'}}};};
await api.catalog();for(const type of ['product','collection']){await api.readSEO('test',type);await api.updateSEO({id:'test',type},{title:'Test',description:'Test'});}
const source=await (await import('node:fs/promises')).readFile(new URL('../app/lib/workspace.server.mjs',import.meta.url),'utf8');
for(const match of source.matchAll(/api\.query\('(query ImageAlt[^']+|mutation UpdateImageAlt[^']+)'/g))queries.push(match[1]);
queries.push(IMAGE_SOURCE_QUERY,IMAGE_REPLACE_MUTATION);
await mkdir('artifacts/operations',{recursive:true});
for(const [i,q] of queries.entries())await writeFile(`artifacts/operations/${i+1}.graphql`,q);
console.log(`Collected ${queries.length} exact application operations (no network requests).`);
