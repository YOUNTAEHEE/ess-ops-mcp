import {randomUUID,timingSafeEqual} from 'node:crypto';
import {rpc,tools} from '../lib/ops.ts';
import {toolOutcome} from '../lib/outcome.ts';

export type AuditEvent={id:string;createdAt:string;tool:string;outcome:string;durationMs:number};
export interface AuditStore {append(event:AuditEvent):Promise<void>;recent():Promise<AuditEvent[]>;}
type Config={token:string;store:AuditStore;allowedOrigins?:string[];rateLimit?:number};
const catalog=new Set(tools.map(t=>t.name));

// Counters are per function instance. Vercel Firewall provides the perimeter;
// this bounded counter is an additional burst guard, not a distributed quota.
export function createVercelHandler(config:Config){
 let windowStart=Date.now(),requests=0;
 return async function handle(request:Request,route:string):Promise<Response>{
  const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  const reply=(status:number,data:unknown)=>new Response(data===null?null:JSON.stringify(data),{status,headers});
  const origin=request.headers.get('origin');
  const ownOrigin=new URL(request.url).origin;
  if(origin&&origin!==ownOrigin&&!config.allowedOrigins?.includes(origin))return reply(403,{error:'Origin not allowed'});
  if(origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');}
  if(request.method==='OPTIONS'){
   headers.set('Access-Control-Allow-Methods','POST, GET, OPTIONS');
   headers.set('Access-Control-Allow-Headers','Authorization, Content-Type, Accept, MCP-Protocol-Version');
   return reply(204,null);
  }
  if(route==='healthz'&&request.method==='GET')return reply(200,{status:'ok',service:'ess-ops-mcp',version:'1.0.0',data:'synthetic-demo',runtime:'Vercel Functions',storage:'private Vercel Blob',auditConfigured:!!config.token&&config.token.length>=32});
  if(!['mcp','audit','demo','mcp-preview'].includes(route))return reply(404,{error:'Not found'});
  if(config.token.length<32)return reply(503,{error:'MCP credential is not configured'});
  const expected=Buffer.from(config.token),provided=Buffer.from(/^Bearer (.+)$/.exec(request.headers.get('authorization')??'')?.[1]??'');
  const authenticated=expected.length===provided.length&&timingSafeEqual(expected,provided);
  if(route==='audit'){
   if(!authenticated)return reply(401,{error:'Authentication required'});
   if(request.method!=='GET')return reply(405,{error:'Use GET'});
   try{return reply(200,{persisted:true,storage:'private Vercel Blob',events:await config.store.recent()});}
   catch{return reply(503,{persisted:false,error:'Audit storage unavailable'});}
  }
  if(request.method!=='POST'){headers.set('Allow','POST');return reply(405,{error:'Use POST JSON-RPC'});}
  if(Date.now()-windowStart>=60000){windowStart=Date.now();requests=0;}
  if(++requests>(config.rateLimit??120)){headers.set('Retry-After','60');return reply(429,{error:'Rate limit exceeded'});}
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return reply(415,{error:'JSON required'});
  if(Number(request.headers.get('content-length')??0)>16384)return reply(413,{error:'Request too large'});
  let raw='';
  if(request.body){
   const reader=request.body.getReader();let size=0;const decoder=new TextDecoder();
   try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>16384){await reader.cancel();return reply(413,{error:'Request too large'});}raw+=decoder.decode(chunk.value,{stream:true});}raw+=decoder.decode();}
   catch{return reply(400,{error:'Request body unavailable'});}
  }
  let message:any;try{message=JSON.parse(raw);}catch{return reply(400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
  const isPreview=route==='demo'||route==='mcp-preview';
  // The public preview has the same fixed, synthetic read-only catalog. It has
  // no audit access and never receives or exposes the owner's MCP credential.
  if(route==='demo')message={jsonrpc:'2.0',id:randomUUID(),method:'tools/call',params:{name:message.tool,arguments:message.arguments??{}}};
  const started=Date.now();const response=await rpc(message,authenticated||isPreview);
  let persisted=false;
  if(!isPreview&&authenticated&&message?.method==='tools/call'){
   const result=response.body?.result as {isError?:boolean;structuredContent?:unknown}|undefined;
   const event:AuditEvent={id:randomUUID(),createdAt:new Date().toISOString(),tool:catalog.has(message.params?.name)?message.params.name:'invalid',outcome:response.body?.error?'invalid':result?.isError?'error':toolOutcome(result?.structuredContent),durationMs:Date.now()-started};
   try{await config.store.append(event);persisted=true;}
   catch{console.error(JSON.stringify({event:'audit_unavailable',tool:event.tool,outcome:event.outcome}));}
   headers.set('X-Audit-Persisted',String(persisted));
  }
  if(route==='demo'){
   const result=response.body?.result as {structuredContent?:unknown;isError?:boolean}|undefined;
   if(response.body?.error||result?.isError)return reply(400,{error:response.body?.error?.message??'Demo unavailable'});
   return reply(response.status,{data:result?.structuredContent,audit:{persisted:false,scope:'browser-session'}});
  }
  return reply(response.status,response.body);
 };
}
