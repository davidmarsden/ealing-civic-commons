import { DEFAULT_BASE_URL, EALING_AUTHORITY_SLUG, parseAuthorityAtom } from '../../scripts/lib/whatdotheyknow.mjs';
import { whatDoTheyKnowCommonsItem } from '../../scripts/lib/whatdotheyknow-commons.mjs';
import { upsertMutableItems } from '../lib/civic-items.mjs';

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const headers={'user-agent':'EalingCivicCommons/0.1 (+https://ealing.civiccommons.co.uk)','accept':'application/atom+xml,application/xml;q=0.9,*/*;q=0.8'};
const DEFAULT_RELAY_URL='https://chat-dev.ealing.civiccommons.co.uk/relay/whatdotheyknow/ealing';
async function get(url){const response=await fetch(url,{headers,redirect:'follow'});const body=await response.text();if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${response.url}`);return body;}
function isDeployPreview(request){if(process.env.CONTEXT==='deploy-preview')return true;try{return /^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/i.test(new URL(request.url).hostname);}catch{return false;}}

export default async request=>{
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!isDeployPreview(request))return json({error:'WhatDoTheyKnow preview publishing is only available on Netlify Deploy Previews.'},403);
  const baseUrl=process.env.WDTK_BASE_URL||DEFAULT_BASE_URL,authoritySlug=process.env.WDTK_AUTHORITY_SLUG||EALING_AUTHORITY_SLUG;
  const requested=Number(new URL(request.url).searchParams.get('limit')||100),limit=Math.max(1,Math.min(100,Number.isFinite(requested)?requested:100));
  // WDTK's public HTML and JSON routes are protected by a Cloudflare managed
  // challenge for server-side clients. The authority Atom feed is accessible from
  // our controlled static-egress host, so Deploy Previews use that narrow relay by
  // default. WDTK_FEED_URL remains configurable for future production infrastructure.
  const feedUrl=process.env.WDTK_FEED_URL||DEFAULT_RELAY_URL;
  try{
    const body=await get(feedUrl);
    const requests=parseAuthorityAtom(body,{baseUrl,authoritySlug}).slice(0,limit);
    if(!requests.length)throw new Error('WhatDoTheyKnow Atom feed contained no ingestible request entries.');
    const commonsItems=requests.map(whatDoTheyKnowCommonsItem);
    const persistence=await upsertMutableItems(commonsItems);
    return json({ok:true,authoritySlug,discoveryUrl:feedUrl,discoveryMode:'atom-static-relay',requested:limit,discovered:requests.length,normalised:commonsItems.length,rejected:0,persistence,limitations:['Atom-only acquisition: correspondence threads and attachment metadata are not available until a richer machine-readable endpoint is accessible.']});
  }catch(error){console.error('WDTK preview publication failed',error);return json({error:error.message},502);}
};
