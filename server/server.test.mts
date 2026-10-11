import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createMcpServer} from './index.mts';

const token='test-only-credential-with-at-least-32-characters';
const call={jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'get_equipment_status',arguments:{scenario:'timeout'}}};
async function launch(database=':memory:',rateLimit=120){const server=createMcpServer({token,database,allowedOrigins:['https://yountaehee.github.io'],rateLimit});server.listen(0,'127.0.0.1');await once(server,'listening');const a=server.address() as {port:number};return {server,url:`http://127.0.0.1:${a.port}`,close:()=>new Promise<void>((r,j)=>server.close(e=>e?j(e):r()))};}
const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};

test('HTTP auth, protocol discovery and partial-success audit',async()=>{
 const app=await launch();try{
  assert.equal((await fetch(app.url+'/healthz')).status,200);
  const unauth=await fetch(app.url+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(call)});assert.equal(unauth.status,401);
  const badScheme=await fetch(app.url+'/mcp',{method:'POST',headers:{...headers,Authorization:token},body:JSON.stringify(call)});assert.equal(badScheme.status,401);
  const discovery=await fetch(app.url+'/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});assert.equal((await discovery.json() as any).result.tools.length,6);
  const result=await fetch(app.url+'/mcp',{method:'POST',headers,body:JSON.stringify(call)});const body=await result.json() as any;assert.equal(body.result.structuredContent.available.length,3);assert.equal(body.result.structuredContent.failures[0].data,null);
  assert.equal((await fetch(app.url+'/audit')).status,401);
  const audit=await fetch(app.url+'/audit',{headers});const log=await audit.json() as any;assert.equal(log.events.length,3);assert.ok(log.events.some((e:any)=>e.outcome==='partial'));assert.ok(!JSON.stringify(log).includes(token));
 }finally{await app.close();}
});
test('Origin, body limits, methods and malformed JSON',async()=>{
 const app=await launch();try{
  assert.equal((await fetch(app.url+'/mcp',{method:'POST',headers:{...headers,Origin:'https://other.example'},body:JSON.stringify(call)})).status,403);
  const preflight=await fetch(app.url+'/mcp',{method:'OPTIONS',headers:{Origin:'https://yountaehee.github.io'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://yountaehee.github.io');
  assert.equal((await fetch(app.url+'/mcp')).status,405);
  assert.equal((await fetch(app.url+'/mcp',{method:'POST',headers,body:'{'})).status,400);
  assert.equal((await fetch(app.url+'/mcp',{method:'POST',headers,body:'x'.repeat(17000)})).status,413);
 }finally{await app.close();}
});
test('SQLite survives restart; bounded catalog names only',async()=>{
 const folder=mkdtempSync(join(tmpdir(),'ess-mcp-test-'));const database=join(folder,'audit.sqlite');
 let app=await launch(database);try{
  await fetch(app.url+'/mcp',{method:'POST',headers,body:JSON.stringify({...call,params:{name:'private-arbitrary-text',arguments:{}}})});await app.close();app=await launch(database);
  const data=await (await fetch(app.url+'/audit',{headers})).json() as any;assert.equal(data.events.length,1);assert.equal(data.events[0].tool,'invalid');assert.ok(!JSON.stringify(data).includes('private-arbitrary-text'));
 }finally{await app.close();rmSync(folder,{recursive:true,force:true});}
});
test('rate limit and missing production credential',async()=>{
 assert.throws(()=>createMcpServer({token:'',database:':memory:',allowedOrigins:[]}));const app=await launch(':memory:',1);try{
  const req={method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'})};assert.equal((await fetch(app.url+'/mcp',req)).status,200);assert.equal((await fetch(app.url+'/mcp',req)).status,429);
 }finally{await app.close();}
});
