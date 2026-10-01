import { DEFAULT_BASE_URL, EALING_AUTHORITY_SLUG, normalizeRequestJson, parseAuthorityAtom, requestSlug } from '../../scripts/lib/whatdotheyknow.mjs';
import { whatDoTheyKnowCommonsItem } from '../../scripts/lib/whatdotheyknow-commons.mjs';
import { upsertMutableItems } from '../lib/civic-items.mjs';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const headers={'user-agent':'EalingCivicCommons/0.1 (+https://ealing.civiccommons.co.uk)','accept':'application/json,application/atom+xml,application/xml,text/html;q=0.9,*/*;q=0.8'};
async function get(url){const response=await fetch(url,{headers,redirect:'follow'});const body=await response.text();if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${response.url}`);return body;}
function htmlRequests(html,{baseUrl,authoritySlug}){
  const found=new Map();
  for(const match of html.matchAll(/href=["']([^"']*\/request\/[^"'?#]+)[^"']*["']/gi)){
    const url=new URL(match[1],baseUrl).toString().replace(/[?#].*$/,'');
    const sourceId=requestSlug(url);if(!sourceId||found.has(sourceId))continue;
    found.set(sourceId,{source:'whatdotheyknow',sourceType:'foi-request',sourceId,url,title:sourceId.replaceAll('_',' '),summary:null,createdAt:null,updatedAt:null,authority:{name:'Ealing Borough Council',urlName:authoritySlug,url:`${baseUrl}/body/${authoritySlug}`}});
  }
  return [...found.values()];
}
async function authorityRequests(baseUrl,authoritySlug,limit){
  const authorityUrl=`${baseUrl}/body/${authoritySlug}`;
  for(const url of [`${baseUrl}/feed/body/${authoritySlug}`,`${authorityUrl}/feed`,`${authorityUrl}.atom`,`${authorityUrl}?format=atom`]){
    try{const body=await get(url);const items=parseAuthorityAtom(body,{baseUrl,authoritySlug});if(items.length)return{url,items,mode:'feed'};}catch(error){console.warn('WDTK feed candidate failed',url,error.message)}
  }
  // WDTK currently renders the authority request list reliably even when its advertised
  // Atom route is unavailable to our runtime. Discover canonical /request/ links from
  // paginated authority HTML as a bounded fallback; each request is still hydrated from
  // its structured .json representation below.
  const items=[],seen=new Set();
  for(let page=1;page<=10&&items.length<limit;page++){
    const url=page===1?authorityUrl:`${authorityUrl}?page=${page}`;
    const body=await get(url),pageItems=htmlRequests(body,{baseUrl,authoritySlug});
    if(!pageItems.length)break;
    let added=0;for(const item of pageItems){if(seen.has(item.sourceId))continue;seen.add(item.sourceId);items.push(item);added++;if(items.length>=limit)break;}if(!added)break;
  }
  if(items.length)return{url:authorityUrl,items,mode:'authority-html'};
  throw new Error('No WhatDoTheyKnow authority requests could be discovered.');
}
function isDeployPreview(request){if(process.env.CONTEXT==='deploy-preview')return true;try{return /^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/i.test(new URL(request.url).hostname);}catch{return false;}}

export default async request=>{
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!isDeployPreview(request))return json({error:'WhatDoTheyKnow preview publishing is only available on Netlify Deploy Previews.'},403);
  const baseUrl=process.env.WDTK_BASE_URL||DEFAULT_BASE_URL,authoritySlug=process.env.WDTK_AUTHORITY_SLUG||EALING_AUTHORITY_SLUG;
  const requested=Number(new URL(request.url).searchParams.get('limit')||100),limit=Math.max(1,Math.min(100,Number.isFinite(requested)?requested:100));
  try{
    const discovery=await authorityRequests(baseUrl,authoritySlug,limit),commonsItems=[],errors=[];
    for(const summary of discovery.items.slice(0,limit)){
      try{const body=await get(`${summary.url}.json`);const normalized=normalizeRequestJson(JSON.parse(body),{baseUrl,authoritySlug,fallback:summary});commonsItems.push(whatDoTheyKnowCommonsItem(normalized));}
      catch(error){errors.push({sourceId:summary.sourceId,error:error.message});}
    }
    if(!commonsItems.length)throw new Error(`Discovered ${discovery.items.length} requests but none of their JSON representations could be normalised.`);
    const persistence=await upsertMutableItems(commonsItems);
    return json({ok:true,authoritySlug,discoveryUrl:discovery.url,discoveryMode:discovery.mode,requested:limit,discovered:discovery.items.length,normalised:commonsItems.length,rejected:errors.length,persistence,errors:errors.slice(0,10)});
  }catch(error){console.error('WDTK preview publication failed',error);return json({error:error.message},502);}
};
