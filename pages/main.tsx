import {createRoot} from 'react-dom/client';
import Console,{type ConsoleTransport} from '../app/console';
import {executeTool,rpc} from '../lib/ops';
import {toolOutcome} from '../lib/outcome';
import '../app/globals.css';

const events:{id:string;createdAt:string;tool:string;outcome:string;durationMs:number}[]=[];
const record=(tool:string,data:unknown,start:number)=>{events.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),tool,outcome:toolOutcome(data),durationMs:Date.now()-start});events.splice(30);};
const browserTransport:ConsoleTransport={
 auditDescription:'현재 탭의 브라우저 메모리 기록 · 새로고침하면 초기화됩니다. 서버 저장 기록과 구분합니다.',
 runtimeLabel:'GitHub Pages · React · TypeScript · 브라우저 모의 시연',
 mcpUrl:'Oracle Cloud 배포 준비 중',
 previewDescription:'동일한 JSON-RPC 처리기를 브라우저에서 시연합니다. 원격 MCP 연결 성공을 의미하지 않습니다.',
 queryLabel:'브라우저 모의 조회',
 async call(tool,args){if(tool==='request_audit')return {data:{events:[...events],persisted:false,available:true},audit:{persisted:false}};const start=Date.now();const data=await executeTool(tool,args);record(tool,data,start);return {data,audit:{persisted:false}};},
 async rpc(message){const start=Date.now();const response=await rpc(message,true);const result=response.body?.result as {structuredContent?:unknown}|undefined;record('get_equipment_status',result?.structuredContent,start);return response.body;},
};
async function post(path:string,message:unknown){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify(message)});
 const body=await response.json() as {error?:string|{message:string};data?:unknown;result?:{structuredContent?:unknown}};
 if(!response.ok)throw new Error(typeof body.error==='string'?body.error:body.error?.message??`HTTP ${response.status}`);return body;
}
const remoteTransport:ConsoleTransport={
 auditDescription:'현재 탭에서 실행한 서버 조회 기록 · 새로고침하면 초기화됩니다. 인증된 MCP 호출 기록은 별도 비공개 Blob에 저장합니다.',
 runtimeLabel:'Vercel Hobby · React · TypeScript · 원격 HTTP 조회',
 mcpUrl:`${window.location.origin}/mcp`,
 connectionDescription:'MCP 클라이언트에서 Bearer 토큰을 설정해 연결합니다. 토큰은 공개 화면이나 소스에 포함하지 않습니다.',
 bannerLabel:'Vercel 서버 조회',
 queryLabel:'원격 서버 조회',
 previewDescription:'공개 모의 데이터용 서버 미리보기입니다. MCP 클라이언트의 /mcp 도구 호출은 Bearer 인증이 필요합니다.',
 async call(tool,args){
  if(tool==='request_audit')return {data:{events:[...events],persisted:false,available:true},audit:{persisted:false}};
  const start=Date.now();const body=await post('/api/demo',{tool,arguments:args});record(tool,body.data,start);return body;
 },
 async rpc(message){const start=Date.now();const body=await post('/api/mcp-preview',message);record('get_equipment_status',body.result?.structuredContent,start);return body;},
};
const transport=import.meta.env.MODE==='vercel'?remoteTransport:browserTransport;
createRoot(document.getElementById('root')!).render(<Console transport={transport}/>);
