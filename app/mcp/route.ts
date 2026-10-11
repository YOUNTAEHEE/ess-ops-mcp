import {getChatGPTUser} from '@/app/chatgpt-auth';
import {rpc} from '@/lib/ops';
import {recordAudit} from '@/lib/audit';
import {toolOutcome} from '@/lib/outcome';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return new Response('Origin not allowed',{status:403});
 if(!request.headers.get('content-type')?.includes('application/json'))return new Response('JSON required',{status:415});
 const raw=await request.text();if(raw.length>16384)return new Response('Request too large',{status:413});
 let message;try{message=JSON.parse(raw);}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},{status:400});}
 const started=Date.now();const response=await rpc(message,!!await getChatGPTUser());
 if(message?.method==='tools/call'){const body=response.body as {result?:{isError?:boolean;structuredContent?:unknown};error?:unknown}|null;await recordAudit(String(message.params?.name??'invalid'),response.status===401?'unauthorized':body?.error?'invalid':body?.result?.isError?'error':toolOutcome(body?.result?.structuredContent),Date.now()-started);}
 return response.body===null?new Response(null,{status:202}):Response.json(response.body,{status:response.status,headers:{'Cache-Control':'no-store'}});
}
export function GET(){return new Response('Use POST JSON-RPC.',{status:405,headers:{Allow:'POST'}});}
