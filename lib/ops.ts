import { z } from 'zod';
export const scenarios = ['normal', 'timeout', 'offline', 'flaky'] as const;
export type Scenario = typeof scenarios[number];
export const equipment = [
 {id:'ESS-A01',site:'DEMO-01',label:'동측 배터리',soc:68.4,powerKw:320,temperatureC:29.1,alarmIds:[]},
 {id:'ESS-A02',site:'DEMO-01',label:'서측 배터리',soc:74.2,powerKw:280,temperatureC:38.6,alarmIds:['ALM-001']},
 {id:'ESS-B01',site:'DEMO-02',label:'제1 배터리',soc:52.8,powerKw:-210,temperatureC:27.4,alarmIds:[]},
 {id:'ESS-B02',site:'DEMO-02',label:'제2 배터리',soc:46.1,powerKw:-180,temperatureC:31.2,alarmIds:['ALM-002']},
];
export const alarms = [
 {id:'ALM-001',equipmentId:'ESS-A02',severity:'warning',code:'BAT_TEMP_HIGH',title:'배터리 온도 주의',observed:38.6,threshold:35,unit:'°C',rule:'온도 > 35°C',evidence:'모의 온도 38.6°C가 데모 임계값 35°C를 초과했습니다.',checks:['냉각 장치와 센서 상태를 확인합니다.','온도 추세와 주변 온도를 비교합니다.','실제 현장 조치는 승인된 매뉴얼을 따릅니다.']},
 {id:'ALM-002',equipmentId:'ESS-B02',severity:'info',code:'CELL_DELTA',title:'셀 전압 편차 관찰',observed:0.12,threshold:0.1,unit:'V',rule:'셀 전압 차이 > 0.10V',evidence:'모의 셀 전압 차이 0.12V가 데모 임계값 0.10V를 초과했습니다.',checks:['다음 구간에서도 편차가 유지되는지 확인합니다.','동일 Rack의 추세를 비교합니다.','데모 값으로 실제 설비 진단을 내리지 않습니다.']},
];
const ids=['ESS-A01','ESS-A02','ESS-B01','ESS-B02'] as const;
const definitions = [
 {name:'list_demo_sites',title:'모의 사업장 목록',description:'두 모의 사업장과 장비 목록을 조회합니다. 실제 고객·설비 데이터가 아닙니다.',schema:z.object({}).strict(),inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'get_equipment_status',title:'설비 상태 조회',description:'모의 ESS 상태를 조회합니다. timeout/offline/flaky로 부분 실패와 재시도를 확인합니다. 제어 기능은 없습니다.',schema:z.object({scenario:z.enum(scenarios).default('normal')}).strict(),inputSchema:{type:'object',properties:{scenario:{type:'string',enum:scenarios,default:'normal'}},additionalProperties:false}},
 {name:'query_telemetry',title:'시계열 조회',description:'모의 장비의 최근 SOC·전력·온도 이력을 1/5/15분 간격으로 조회합니다. 최대 240분입니다.',schema:z.object({equipment_id:z.enum(ids),minutes:z.number().int().min(15).max(240).default(60),interval_minutes:z.union([z.literal(1),z.literal(5),z.literal(15)]).default(5)}).strict(),inputSchema:{type:'object',properties:{equipment_id:{type:'string',enum:ids},minutes:{type:'integer',minimum:15,maximum:240,default:60},interval_minutes:{type:'integer',enum:[1,5,15],default:5}},required:['equipment_id'],additionalProperties:false}},
 {name:'list_alarms',title:'알람 목록',description:'모의 알람을 장비 ID로 필터해 조회합니다.',schema:z.object({equipment_id:z.enum(ids).optional()}).strict(),inputSchema:{type:'object',properties:{equipment_id:{type:'string',enum:ids}},additionalProperties:false}},
 {name:'explain_alarm',title:'알람 근거 조회',description:'센서 값·데모 임계값·확인 항목을 반환합니다. 규칙 기반 설명이며 AI 진단·현장 안전 승인으로 쓰지 않습니다.',schema:z.object({alarm_id:z.enum(['ALM-001','ALM-002'])}).strict(),inputSchema:{type:'object',properties:{alarm_id:{type:'string',enum:['ALM-001','ALM-002']}},required:['alarm_id'],additionalProperties:false}},
 {name:'get_service_health',title:'서비스 상태',description:'데모 버전·출처·지원 기능을 조회합니다. 장기 가동률을 제공하지 않습니다.',schema:z.object({}).strict(),inputSchema:{type:'object',properties:{},additionalProperties:false}},
];
export const tools=definitions.map(({schema,...d})=>({...d,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}));
const inFlight=new Map<string,Promise<unknown>>();
export let providerInvocations=0;
const delay=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
async function snapshot(scenario:Scenario) {
 const existing=inFlight.get(scenario);if(existing)return existing;
 const pending=(async()=>{
  const started=Date.now();
  const results=await Promise.allSettled(equipment.map(async e=>{
   const failed=e.id==='ESS-B02'&&(scenario==='timeout'||scenario==='offline');
   for(let attempt=1;attempt<=2;attempt++){
    providerInvocations++;await delay(failed&&scenario==='timeout'?120:15);
    if(failed||(e.id==='ESS-B02'&&scenario==='flaky'&&attempt===1)){
     if(attempt===2)throw new Error(scenario==='timeout'?'TIMEOUT':'OFFLINE');
     await delay(10);continue;
    }
    return {...e,quality:'fresh',attempts:attempt,observedAt:new Date().toISOString()};
   }throw new Error('UNAVAILABLE');
  }));
  const available=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
  const failures=results.flatMap((r,i)=>r.status==='rejected'?[{equipmentId:equipment[i].id,code:r.reason.message,attempts:2,data:null}]:[]);
  return {source:'synthetic-demo',scenario,available,failures,total:4,partial:failures.length>0,durationMs:Date.now()-started,policy:{maxAttempts:2,timeoutMs:120,concurrentRequests:'shared',missingValue:'null / 성공 데이터 유지'}};
 })();
 inFlight.set(scenario,pending);try{return await pending;}finally{inFlight.delete(scenario);}
}
export async function executeTool(name:string,args:unknown):Promise<unknown>{
 const d=definitions.find(d=>d.name===name);if(!d)throw new Error('UNKNOWN_TOOL');
 const input=d.schema.parse(args??{}) as Record<string,unknown>;
 switch(name){
  case 'list_demo_sites':return {source:'synthetic-demo',sites:[{id:'DEMO-01',name:'한빛 모의 사업장',equipment:equipment.filter(e=>e.site==='DEMO-01')},{id:'DEMO-02',name:'솔빛 모의 사업장',equipment:equipment.filter(e=>e.site==='DEMO-02')}]};
  case 'get_equipment_status':return snapshot(input.scenario as Scenario);
  case 'query_telemetry':{
   const e=equipment.find(e=>e.id===input.equipment_id)!;const minutes=input.minutes as number;const step=input.interval_minutes as number;const end=Math.floor(Date.now()/300000)*300000;const points=[];
   for(let ago=minutes;ago>=0;ago-=step){const wave=Math.sin(ago/18);points.push({timestamp:new Date(end-ago*60000).toISOString(),soc:Math.round((e.soc+wave*4)*10)/10,powerKw:Math.round(e.powerKw+wave*35),temperatureC:Math.round((e.temperatureC+wave*.8)*10)/10});}
   return {source:'synthetic-demo',equipmentId:e.id,intervalMinutes:step,points};
  }
  case 'list_alarms':return {source:'synthetic-demo',alarms:alarms.filter(a=>!input.equipment_id||a.equipmentId===input.equipment_id)};
  case 'explain_alarm':return {source:'synthetic-demo',method:'deterministic-rule',alarm:alarms.find(a=>a.id===input.alarm_id),limitations:'모의 임계값 설명입니다. 실제 원인 확정·조치 승인이 아닙니다.'};
  default:return {status:'ok',version:'1.0.0',projectStarted:'2026-10-11',source:'synthetic-demo',transport:'stateless Streamable HTTP',tools:6,capabilities:['read-only','bounded-retry','partial-success','inflight-deduplication','request-audit'],operationRecord:'새로 배포한 개인 데모; 장기 운영 이력 없음'};
 }
}
type RpcBody={jsonrpc:string;id:unknown;result?:unknown;error?:{code:number;message:string}};
export async function rpc(message:unknown,authenticated:boolean):Promise<{status:number;body:RpcBody|null}>{
 if(!message||typeof message!=='object'||Array.isArray(message))return {status:400,body:{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}}};
 const m=message as {jsonrpc?:unknown;id?:unknown;method?:unknown;params?:Record<string,unknown>};const hasId=Object.prototype.hasOwnProperty.call(m,'id');const id=m.id??null;
 if(m.jsonrpc!=='2.0'||typeof m.method!=='string'||(hasId&&id!==null&&typeof id!=='number'&&typeof id!=='string'))return {status:400,body:{jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid Request'}}};
 const result=(data:unknown)=>({status:200,body:{jsonrpc:'2.0',id,result:data}});const error=(code:number,text:string)=>({status:200,body:{jsonrpc:'2.0',id,error:{code,message:text}}});
 if(!hasId)return {status:202,body:null};
 if(m.method==='initialize'){const requested=m.params?.protocolVersion;return result({protocolVersion:['2025-06-18','2025-11-25'].includes(String(requested))?requested:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'ess-ops-mcp',version:'1.0.0'},instructions:'조회 전용 모의 ESS 데이터입니다. 실제 설비 연결·제어·AI 진단이 없습니다.'});}
 if(m.method==='ping')return result({});if(m.method==='tools/list')return result({tools});
 if(m.method!=='tools/call')return error(-32601,'Method not found');
 if(!authenticated)return {status:401,body:{jsonrpc:'2.0',id,error:{code:-32001,message:'Authentication required'}}};
 try{const data=await executeTool(String(m.params?.name??''),m.params?.arguments??{});return result({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false});}
 catch(e){if(e instanceof z.ZodError)return error(-32602,'Invalid tool arguments');if(e instanceof Error&&e.message==='UNKNOWN_TOOL')return error(-32602,'Unknown tool');return result({content:[{type:'text',text:'Demo provider unavailable; retry later.'}],isError:true});}
}
