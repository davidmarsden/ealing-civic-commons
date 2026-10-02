import { DEFAULT_BASE_URL, EALING_AUTHORITY_SLUG, parseAuthorityAtom } from '../../scripts/lib/whatdotheyknow.mjs';
import { whatDoTheyKnowCommonsItem } from '../../scripts/lib/whatdotheyknow-commons.mjs';
import { upsertMutableItems } from '../lib/civic-items.mjs';

const RELAY='https://chat-dev.ealing.civiccommons.co.uk/relay/whatdotheyknow/ealing';
const headers={'user-agent':'EalingCivicCommons/0.1 (+https://ealing.civiccommons.co.uk)','accept':'application/atom+xml,application/xml;q=0.9,*/*;q=0.8'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export default async request=>{
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  // Netlify Scheduled Functions identify scheduler invocations with x-nf-event.
  // Manual public POSTs are intentionally refused in production.
  if(request.headers.get('x-nf-event')!=='schedule')return json({error:'Scheduled invocation required'},403);
  const baseUrl=process.env.WDTK_BASE_URL||DEFAULT_BASE_URL,authoritySlug=process.env.WDTK_AUTHORITY_SLUG||EALING_AUTHORITY_SLUG,feedUrl=process.env.WDTK_FEED_URL||RELAY;
  try{
    const response=await fetch(feedUrl,{headers,redirect:'follow'}),body=await response.text();
    if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${response.url}`);
    // The live Atom feed is intentionally the bounded recent window. Repeated runs
    // update mutable requests and add new ones without attempting the historical corpus.
    const requests=parseAuthorityAtom(body,{baseUrl,authoritySlug});
    if(!requests.length)throw new Error('WhatDoTheyKnow Atom feed contained no ingestible request entries.');
    const items=requests.map(whatDoTheyKnowCommonsItem),persistence=await upsertMutableItems(items);
    return json({ok:true,authoritySlug,discoveryMode:'atom-static-relay',discovered:requests.length,normalised:items.length,persistence,limitations:['Recent Atom window only; historical backfill is separate.','Correspondence threads and attachment metadata are unavailable from Atom.']});
  }catch(error){console.error('Scheduled WDTK publication failed',error);return json({error:error.message},502);}
};

export const config={schedule:'17 */6 * * *'};
