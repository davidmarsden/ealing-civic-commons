import coreFeedHandler from './combined-feed-core.mjs';
import { listArchivedItems } from '../lib/civic-items.mjs';
import { withPlaceLinks } from '../lib/civic-place-links.mjs';
import { withPlausibleDate } from '../lib/item-dates.mjs';
import { readSnapshot, SNAPSHOT_MAX_AGE_MS, store as feedStore } from '../lib/feed-snapshot.mjs';

const WDTK_SOURCE_ID='whatdotheyknow';
const WDTK_SOURCE_NAME='WhatDoTheyKnow — Ealing Council';
const WDTK_HOMEPAGE='https://www.whatdotheyknow.com/body/ealing_borough_council';
const LIVE_LIMIT=220;
const COVERAGE_WINDOW_MS=90*24*60*60*1000;
const publishedTime=item=>{const t=Date.parse(item?.publishedAt||'');return Number.isFinite(t)?t:0};
const key=item=>item?.canonicalUrl||item?.dedupeKey||item?.id||null;

function coveragePreservingSlice(items=[],limit=LIVE_LIMIT){
  const seen=new Set();
  const sorted=[...items].sort((a,b)=>publishedTime(b)-publishedTime(a)).filter(item=>{const k=key(item);if(!k||seen.has(k))return false;seen.add(k);return true});
  const cutoff=Date.now()-COVERAGE_WINDOW_MS,reservedBySource=new Map();
  for(const item of sorted){
    if(!item?.sourceId||item.sourceClass==='Official record'||publishedTime(item)<cutoff)continue;
    if(!reservedBySource.has(item.sourceId))reservedBySource.set(item.sourceId,item);
  }
  const selected=new Map();
  for(const item of reservedBySource.values()){const k=key(item);if(k)selected.set(k,item)}
  for(const item of sorted){if(selected.size>=limit)break;const k=key(item);if(k&&!selected.has(k))selected.set(k,item)}
  return [...selected.values()].sort((a,b)=>publishedTime(b)-publishedTime(a)).slice(0,limit);
}

async function recentWhatDoTheyKnow(){
  try{
    const archive=await listArchivedItems({limit:40,sourceId:WDTK_SOURCE_ID});
    return {items:(archive.records||[]).map(record=>record.item).filter(Boolean),archiveSize:archive.matchedSize||0,error:null};
  }catch(error){return {items:[],archiveSize:0,error:String(error?.message||error)}}
}

// Live build: fans out to every upstream source. Only the background ingest (and
// the fallback below) should call this.
export async function buildCombinedFeed(request){
  const [coreResponse,wdtk]=await Promise.all([coreFeedHandler(request),recentWhatDoTheyKnow()]);
  const core=coreResponse?.ok?await coreResponse.json():{generatedAt:new Date().toISOString(),items:[],health:[],enrichment:{}};
  const now=Date.now();
  const items=coveragePreservingSlice([...(wdtk.items||[]),...(core.items||[])].map(item=>withPlausibleDate(item,now))).map(withPlaceLinks);
  const health=[...(core.health||[]),{id:WDTK_SOURCE_ID,name:WDTK_SOURCE_NAME,homepage:WDTK_HOMEPAGE,ok:!wdtk.error,status:wdtk.error?'error':(wdtk.items.length?'ok':'empty'),error:wdtk.error,itemCount:wdtk.items.length}].sort((a,b)=>String(a?.name||'').localeCompare(String(b?.name||''),'en-GB',{sensitivity:'base'}));
  return new Response(JSON.stringify({...core,generatedAt:new Date().toISOString(),items,health,enrichment:{...(core.enrichment||{}),placeLinks:{method:'Explicit place mentions and deliberately narrow civic-context rules attach records to durable Commons place routes. Inferred links remain attributable discovery metadata rather than reviewed civic assertions.'},whatDoTheyKnow:{included:wdtk.items.length,archiveSize:wdtk.archiveSize,method:'Recent Ealing Council FOI/EIR requests persisted by the scheduled WhatDoTheyKnow publisher are projected from the Civic Archive into Latest. The original WhatDoTheyKnow request remains canonical.'}}}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, stale-while-revalidate=900','netlify-cdn-cache-control':'public, durable, s-maxage=300, stale-while-revalidate=900','access-control-allow-origin':'*'}});
}

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, stale-while-revalidate=900','netlify-cdn-cache-control':'public, durable, s-maxage=300, stale-while-revalidate=900','access-control-allow-origin':'*'};

// Serves the snapshot written by the background ingest while it is fresh. When it
// is missing or older than SNAPSHOT_MAX_AGE_MS the feed is built live, so a stalled
// ingest degrades to the old behaviour rather than to stale or empty data.
export async function serveCombinedFeed(request,{readFeedSnapshot=()=>readSnapshot(feedStore()),build=buildCombinedFeed,maxAgeMs=SNAPSHOT_MAX_AGE_MS}={}){
  const snapshot=await readFeedSnapshot().catch(error=>{console.error('Combined feed snapshot unavailable',error);return null});
  if(snapshot&&snapshot.ageMs<=maxAgeMs)return new Response(JSON.stringify({...snapshot.feed,snapshot:{servedFrom:'snapshot',ageSeconds:Math.round(snapshot.ageMs/1000)}}),{headers:HEADERS});
  const reason=snapshot?`snapshot is ${Math.round(snapshot.ageMs/60000)} minutes old`:'no snapshot';
  console.warn(`Combined feed built live: ${reason}`);
  const live=await build(request);
  if(!live?.ok)return live;
  const feed=await live.json();
  return new Response(JSON.stringify({...feed,snapshot:{servedFrom:'live',reason}}),{headers:HEADERS});
}

export default request=>serveCombinedFeed(request);
