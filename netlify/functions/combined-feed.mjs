import coreFeedHandler from './combined-feed-core.mjs';
import { listArchivedItems } from '../lib/civic-items.mjs';

const WDTK_SOURCE_ID='whatdotheyknow-ealing';
const WDTK_SOURCE_NAME='WhatDoTheyKnow — Ealing Council';
const WDTK_HOMEPAGE='https://www.whatdotheyknow.com/body/ealing_borough_council';
const publishedTime=item=>{const t=Date.parse(item?.publishedAt||'');return Number.isFinite(t)?t:0};
const key=item=>item?.canonicalUrl||item?.dedupeKey||item?.id||null;

async function recentWhatDoTheyKnow(){
  try{
    const archive=await listArchivedItems({limit:40,sourceId:WDTK_SOURCE_ID});
    return {items:(archive.records||[]).map(record=>record.item).filter(Boolean),archiveSize:archive.matchedSize||0,error:null};
  }catch(error){return {items:[],archiveSize:0,error:String(error?.message||error)}}
}

export default async request=>{
  const [coreResponse,wdtk]=await Promise.all([coreFeedHandler(request),recentWhatDoTheyKnow()]);
  const core=coreResponse?.ok?await coreResponse.json():{generatedAt:new Date().toISOString(),items:[],health:[],enrichment:{}};
  const seen=new Set(),items=[...(wdtk.items||[]),...(core.items||[])].sort((a,b)=>publishedTime(b)-publishedTime(a)).filter(item=>{const k=key(item);if(!k||seen.has(k))return false;seen.add(k);return true}).slice(0,220);
  const health=[...(core.health||[]),{id:WDTK_SOURCE_ID,name:WDTK_SOURCE_NAME,homepage:WDTK_HOMEPAGE,ok:!wdtk.error,status:wdtk.error?'error':(wdtk.items.length?'ok':'empty'),error:wdtk.error,itemCount:wdtk.items.length}].sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'en-GB',{sensitivity:'base'}));
  return new Response(JSON.stringify({...core,generatedAt:new Date().toISOString(),items,health,enrichment:{...(core.enrichment||{}),whatDoTheyKnow:{included:wdtk.items.length,archiveSize:wdtk.archiveSize,method:'Recent Ealing Council FOI/EIR requests persisted by the scheduled WhatDoTheyKnow publisher are projected from the Civic Archive into Latest. The original WhatDoTheyKnow request remains canonical.'}}}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, stale-while-revalidate=900','access-control-allow-origin':'*'}});
};
