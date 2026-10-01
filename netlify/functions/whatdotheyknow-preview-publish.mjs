import { DEFAULT_BASE_URL, EALING_AUTHORITY_SLUG, normalizeRequestJson, parseAuthorityAtom } from '../../scripts/lib/whatdotheyknow.mjs';
import { whatDoTheyKnowCommonsItem } from '../../scripts/lib/whatdotheyknow-commons.mjs';
import { upsertMutableItems } from '../lib/civic-items.mjs';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const headers={'user-agent':'EalingCivicCommons/0.1 (+https://ealing.civiccommons.co.uk)','accept':'application/json,application/atom+xml,application/xml;q=0.9,*/*;q=0.8'};
async function get(url){const response=await fetch(url,{headers,redirect:'follow'});const body=await response.text();if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${response.url}`);return body;}
async function authorityFeed(baseUrl,authoritySlug){const authorityUrl=`${baseUrl}/body/${authoritySlug}`;for(const url of [`${authorityUrl}/feed`,`${authorityUrl}.atom`,`${authorityUrl}?format=atom`]){try{const body=await get(url);const items=parseAuthorityAtom(body,{baseUrl,authoritySlug});if(items.length)return{url,items};}catch(error){console.warn('WDTK feed candidate failed',url,error.message)}}throw new Error('No WhatDoTheyKnow authority feed parsed.');}

export default async request=>{
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  // This endpoint exists solely to populate an isolated Deploy Preview blob store
  // for editorial inspection. Never permit it on branch/production deploys.
  if(process.env.CONTEXT!=='deploy-preview')return json({error:'WhatDoTheyKnow preview publishing is only available on Netlify Deploy Previews.'},403);
  const baseUrl=process.env.WDTK_BASE_URL||DEFAULT_BASE_URL,authoritySlug=process.env.WDTK_AUTHORITY_SLUG||EALING_AUTHORITY_SLUG;
  const requested=Number(new URL(request.url).searchParams.get('limit')||100),limit=Math.max(1,Math.min(100,Number.isFinite(requested)?requested:100));
  try{
    const feed=await authorityFeed(baseUrl,authoritySlug),commonsItems=[],errors=[];
    for(const summary of feed.items.slice(0,limit)){
      try{const body=await get(`${summary.url}.json`);const normalized=normalizeRequestJson(JSON.parse(body),{baseUrl,authoritySlug,fallback:summary});commonsItems.push(whatDoTheyKnowCommonsItem(normalized));}
      catch(error){errors.push({sourceId:summary.sourceId,error:error.message});}
    }
    const persistence=await upsertMutableItems(commonsItems);
    return json({ok:true,authoritySlug,feedUrl:feed.url,requested:limit,normalised:commonsItems.length,rejected:errors.length,persistence,errors:errors.slice(0,10)});
  }catch(error){console.error('WDTK preview publication failed',error);return json({error:error.message},502);}
};
