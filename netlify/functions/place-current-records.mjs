import combinedFeedHandler from './combined-feed.mjs';
import { fetchEalingPetitions } from './ealing-petitions.mjs';
import { listArchivedItems } from '../lib/civic-items.mjs';
import { withPlaceLinks, itemLinksToPlace } from '../lib/civic-place-links.mjs';

const canonical=value=>{try{const u=new URL(value);u.hash='';if(u.pathname!=='/')u.pathname=u.pathname.replace(/\/+$/,'');return u.toString()}catch{return String(value||'').trim()}};
const publishedTime=item=>{const t=Date.parse(item?.publishedAt||'');return Number.isFinite(t)?t:0};

export default async request=>{
  const url=new URL(request.url);
  const route=url.searchParams.get('route');
  if(!route||!/^places\/[a-z0-9-]+$/.test(route)) return new Response(JSON.stringify({error:'A valid place route is required.'}),{status:400,headers:{'content-type':'application/json'}});

  const [combinedResponse,petitions,archive]=await Promise.all([
    combinedFeedHandler(request).catch(()=>null),
    fetchEalingPetitions().catch(()=>({items:[]})),
    listArchivedItems({limit:250}).catch(()=>({records:[]}))
  ]);
  const combined=combinedResponse?.ok?await combinedResponse.json():{items:[]};
  const archived=(archive.records||[]).map(record=>record.item).filter(Boolean);
  const candidates=[...(combined.items||[]),...(petitions.items||[]),...archived].map(withPlaceLinks);
  const seen=new Set();
  const items=candidates
    .filter(item=>item?.url&&itemLinksToPlace(item,route))
    .filter(item=>{const key=canonical(item.canonicalUrl||item.url)||item.id;if(!key||seen.has(key))return false;seen.add(key);return true})
    .sort((a,b)=>publishedTime(b)-publishedTime(a))
    .slice(0,50);

  return new Response(JSON.stringify({generatedAt:new Date().toISOString(),route,items,count:items.length}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=180, stale-while-revalidate=600','access-control-allow-origin':'*'}});
};
