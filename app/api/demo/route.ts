import {getChatGPTUser} from '@/app/chatgpt-auth';import {executeTool} from '@/lib/ops';import {recordAudit,recentAudit} from '@/lib/audit';import {z} from 'zod';
import {toolOutcome} from '@/lib/outcome';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(!await getChatGPTUser())return Response.json({error:'로그인이 필요합니다.'},{status:401});
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origin not allowed'},{status:403});
 const started=Date.now();let name='invalid';
 try{const raw=await request.text();if(raw.length>16384)return Response.json({error:'Request too large'},{status:413});const body=JSON.parse(raw);name=String(body.tool??'');const data=name==='request_audit'?await recentAudit():await executeTool(name,body.arguments??{});const audit=name==='request_audit'?{persisted:true}:await recordAudit(name,toolOutcome(data),Date.now()-started);return Response.json({data,audit},{headers:{'Cache-Control':'no-store'}});}
 catch(e){await recordAudit(name,'invalid',Date.now()-started);return Response.json({error:e instanceof z.ZodError?'입력값이 유효하지 않습니다.':'요청을 처리하지 못했습니다.'},{status:400});}
}
