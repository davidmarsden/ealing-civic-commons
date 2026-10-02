import { getStore } from '@netlify/blobs';

const STORE='civic-commons-operations';
const KEY='whatdotheyknow/last-run';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=30, stale-while-revalidate=60'}});

export default async request=>{
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  try{
    const lastRun=await getStore(STORE,{consistency:'strong'}).get(KEY,{type:'json'});
    return json({sourceId:'whatdotheyknow-ealing',source:'WhatDoTheyKnow — Ealing Council',schedule:'17 */6 * * *',lastRun:lastRun||null});
  }catch(error){console.error('WDTK status lookup failed',error);return json({error:'WhatDoTheyKnow publisher status is temporarily unavailable.'},503)}
};
