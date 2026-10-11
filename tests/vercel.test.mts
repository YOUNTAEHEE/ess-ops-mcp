import test from 'node:test';
import assert from 'node:assert/strict';
import {createVercelHandler,type AuditEvent,type AuditStore} from '../server/vercel.ts';

const token='unit-test-only-credential-with-32-plus-characters';
const message={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_equipment_status',arguments:{scenario:'timeout'}}};
class Store implements AuditStore {
 events:AuditEvent[]=[];
 async append(event:AuditEvent){this.events.unshift(event);}
 async recent(){return this.events;}
}
const request=(route:string,body:unknown=message,auth=false,extra:Record<string,string>={})=>new Request(`https://demo.vercel.app/${route}`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${token}`} :{}),...extra},body:JSON.stringify(body)});

test('serverless MCP authentication, partial response and persisted metadata',async()=>{
 const store=new Store(),handle=createVercelHandler({token,store});
 assert.equal((await handle(request('mcp'),'mcp')).status,401);
 assert.equal(store.events.length,0);
 const discovery=await handle(request('mcp',{jsonrpc:'2.0',id:1,method:'tools/list'}),'mcp');
 assert.equal((await discovery.json() as any).result.tools.length,6);
 await handle(request('mcp',{jsonrpc:'2.0',method:'tools/call',params:message.params},true),'mcp');
 assert.equal(store.events.length,0,'notifications must not invent executed calls');
 const response=await handle(request('mcp',message,true),'mcp');
 const result=(await response.json() as any).result.structuredContent;
 assert.equal(result.available.length,3);assert.equal(result.failures[0].data,null);
 assert.equal(response.headers.get('X-Audit-Persisted'),'true');
 assert.equal(store.events[0].outcome,'partial');assert.equal(store.events.length,1);
 // A fresh function instance reads the same external store, not local disk.
 const second=createVercelHandler({token,store});
 assert.equal((await second(new Request('https://demo.vercel.app/audit'),'audit')).status,401);
 const audit=await second(new Request('https://demo.vercel.app/audit',{headers:{Authorization:`Bearer ${token}`}}),'audit');
 const data=await audit.json() as any;assert.equal(data.persisted,true);assert.equal(data.events[0].id,store.events[0].id);
 assert.ok(!JSON.stringify(data).includes(token));
});

test('public synthetic preview cannot read audit, alter catalog or use owner token',async()=>{
 const store=new Store(),handle=createVercelHandler({token,store});
 const response=await handle(request('demo',{tool:'get_equipment_status',arguments:{scenario:'flaky'}}),'demo');
 const body=await response.json() as any;assert.equal(body.data.available.length,4);assert.equal(body.audit.persisted,false);
 assert.equal(store.events.length,0);
 const audit=await handle(request('demo',{tool:'request_audit'}),'demo');assert.equal(audit.status,400);
 const control=await handle(request('mcp-preview',{...message,params:{name:'control_device'}}),'mcp-preview');
 assert.equal((await control.json() as any).error.code,-32602);
 assert.equal((await handle(request('mcp',message,false,{Origin:'https://attacker.example'}),'mcp')).status,403);
});

test('serverless body limit, notifications, methods, origin and burst guard',async()=>{
 const store=new Store(),handle=createVercelHandler({token,store,rateLimit:20});
 assert.equal((await handle(new Request('https://demo.vercel.app/mcp'),'mcp')).status,405);
 const options=await handle(new Request('https://demo.vercel.app/mcp',{method:'OPTIONS',headers:{Origin:'https://demo.vercel.app'}}),'mcp');
 assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),'https://demo.vercel.app');
 assert.equal((await handle(request('mcp',{jsonrpc:'2.0',method:'notifications/initialized'}),'mcp')).status,202);
 assert.equal((await handle(request('mcp','x'.repeat(17000)),'mcp')).status,413);
 assert.equal((await handle(new Request('https://demo.vercel.app/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}),'mcp')).status,400);
 const limited=createVercelHandler({token,store,rateLimit:1});
 await limited(request('mcp',{jsonrpc:'2.0',id:1,method:'ping'}),'mcp');
 assert.equal((await limited(request('mcp'),'mcp')).status,429);
});

test('missing credentials and storage failure are explicit and do not invent persistence',async()=>{
 const missing=createVercelHandler({token:'',store:new Store()});
 assert.equal((await missing(request('mcp'),'mcp')).status,503);
 const unavailable:AuditStore={async append(){throw new Error('storage');},async recent(){throw new Error('storage');}};
 const handle=createVercelHandler({token,store:unavailable});
 const response=await handle(request('mcp',message,true),'mcp');assert.equal(response.status,200);
 assert.equal(response.headers.get('X-Audit-Persisted'),'false');
 const audit=await handle(new Request('https://demo.vercel.app/audit',{headers:{Authorization:`Bearer ${token}`}}),'audit');
 assert.equal(audit.status,503);assert.equal((await audit.json() as any).persisted,false);
});
