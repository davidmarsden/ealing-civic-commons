import { getStore } from '@netlify/blobs';
import { DEFAULT_BASE_URL, EALING_AUTHORITY_SLUG, parseAuthorityAtom } from '../../scripts/lib/whatdotheyknow.mjs';
import { whatDoTheyKnowCommonsItem } from '../../scripts/lib/whatdotheyknow-commons.mjs';
import { upsertMutableItems } from '../lib/civic-items.mjs';

const RELAY='https://chat-dev.ealing.civiccommons.co.uk/relay/whatdotheyknow/ealing';
const STATUS_STORE='civic-commons-operations';
const STATUS_KEY='whatdotheyknow/last-run';
const headers={'user-agent':'EalingCivicCommons/0.1 (+https://ealing.civiccommons.co.uk)','accept':'application/atom+xml,application/xml;q=0.9,*/*;q=0.8'};
async function recordStatus(value){try{await getStore(STATUS_STORE,{consistency:'strong'}).setJSON(STATUS_KEY,value)}catch(error){console.error('WDTK run-status write failed',error)}}

export default async request=>{
  const startedAt=new Date().toISOString();
  let schedulerEvent=null;
  try{schedulerEvent=await request.clone().json()}catch{}
  const baseUrl=process.env.WDTK_BASE_URL||DEFAULT_BASE_URL;
  const authoritySlug=process.env.WDTK_AUTHORITY_SLUG||EALING_AUTHORITY_SLUG;
  const feedUrl=process.env.WDTK_FEED_URL||RELAY;
  try{
    const response=await fetch(feedUrl,{headers,redirect:'follow'});
    const body=await response.text();
    if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${response.url}`);
    const requests=parseAuthorityAtom(body,{baseUrl,authoritySlug});
    if(!requests.length)throw new Error('WhatDoTheyKnow Atom feed contained no ingestible request entries.');
    const items=requests.map(whatDoTheyKnowCommonsItem);
    const persistence=await upsertMutableItems(items);
    const result={ok:true,startedAt,completedAt:new Date().toISOString(),nextRun:schedulerEvent?.next_run||null,authoritySlug,discoveryMode:'atom-static-relay',discovered:requests.length,normalised:items.length,persistence};
    await recordStatus(result);
    console.log('Scheduled WDTK publication succeeded',result);
  }catch(error){
    const failure={ok:false,startedAt,completedAt:new Date().toISOString(),nextRun:schedulerEvent?.next_run||null,authoritySlug,error:String(error?.message||error)};
    await recordStatus(failure);
    console.error('Scheduled WDTK publication failed',error);
  }
};

export const config={schedule:'17 */6 * * *'};
