import {createRoot} from 'react-dom/client';
import Console,{type ConsoleTransport} from '../app/console';
import {executeTool,rpc} from '../lib/ops';
import {toolOutcome} from '../lib/outcome';
import '../app/globals.css';

const events:{id:string;createdAt:string;tool:string;outcome:string;durationMs:number}[]=[];
const record=(tool:string,data:unknown,start:number)=>{events.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),tool,outcome:toolOutcome(data),durationMs:Date.now()-start});events.splice(30);};
const transport:ConsoleTransport={
 auditDescription:'현재 탭의 브라우저 메모리 기록 · 새로고침하면 초기화됩니다. 서버 저장 기록과 구분합니다.',
 runtimeLabel:'GitHub Pages · React · TypeScript · 브라우저 모의 시연',
 mcpUrl:'Oracle Cloud 배포 준비 중',
 previewDescription:'동일한 JSON-RPC 처리기를 브라우저에서 시연합니다. 원격 MCP 연결 성공을 의미하지 않습니다.',
 queryLabel:'브라우저 모의 조회',
 async call(tool,args){if(tool==='request_audit')return {data:{events:[...events],persisted:true},audit:{persisted:false}};const start=Date.now();const data=await executeTool(tool,args);record(tool,data,start);return {data,audit:{persisted:false}};},
 async rpc(message){const start=Date.now();const response=await rpc(message,true);const result=response.body?.result as {structuredContent?:unknown}|undefined;record('get_equipment_status',result?.structuredContent,start);return response.body;},
};
createRoot(document.getElementById('root')!).render(<Console transport={transport}/>);
