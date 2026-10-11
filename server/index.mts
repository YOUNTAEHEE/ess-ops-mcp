import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {timingSafeEqual,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rpc} from '../lib/ops.ts';
import {toolOutcome} from '../lib/outcome.ts';

export function createMcpServer(config:{token:string;database:string;allowedOrigins:string[];rateLimit?:number}){
 if(config.token.length<32)throw new Error('MCP_API_TOKEN must contain at least 32 characters');
 if(config.database!==':memory:')mkdirSync(dirname(config.database),{recursive:true});
 const db=new DatabaseSync(config.database);
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,createdAt TEXT NOT NULL,tool TEXT NOT NULL,outcome TEXT NOT NULL,durationMs INTEGER NOT NULL)');
 const insert=db.prepare('INSERT INTO audit VALUES (?,?,?,?,?)');
 const recent=db.prepare('SELECT * FROM audit ORDER BY createdAt DESC LIMIT 30');
 const trim=db.prepare('DELETE FROM audit WHERE id NOT IN (SELECT id FROM audit ORDER BY createdAt DESC LIMIT 10000)');
 const key=Buffer.from(config.token);let windowStart=Date.now(),requests=0;
 const server=createServer(async(req:IncomingMessage,res:ServerResponse)=>{
  const origin=req.headers.origin;
  const reply=(status:number,body:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body===null?'':JSON.stringify(body));};
  if(origin&&!config.allowedOrigins.includes(origin)){reply(403,{error:'Origin not allowed'});return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST, GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Accept, MCP-Protocol-Version');reply(204,null);return;}
  const route=new URL(req.url??'/','http://localhost').pathname;
  if(route==='/healthz'&&req.method==='GET'){reply(200,{status:'ok',service:'ess-ops-mcp',version:'1.0.0',data:'synthetic-demo',storage:'SQLite'});return;}
  const auth=Buffer.from(/^Bearer (.+)$/.exec(req.headers.authorization??'')?.[1]??'');
  const authenticated=auth.length===key.length&&timingSafeEqual(auth,key);
  if(route==='/audit'&&req.method==='GET'){if(!authenticated){reply(401,{error:'Authentication required'});return;}reply(200,{persisted:true,events:recent.all()});return;}
  if(route!=='/mcp'){reply(404,{error:'Not found'});return;}
  if(req.method!=='POST'){res.setHeader('Allow','POST');reply(405,{error:'Use POST JSON-RPC'});return;}
  if(Date.now()-windowStart>60000){windowStart=Date.now();requests=0;}
  if(++requests>(config.rateLimit??120)){res.setHeader('Retry-After','60');reply(429,{error:'Rate limit exceeded'});return;}
  if(!req.headers['content-type']?.includes('application/json')){reply(415,{error:'JSON required'});return;}
  if(Number(req.headers['content-length']??0)>16384){req.resume();reply(413,{error:'Request too large'});return;}
  let raw='',size=0;
  try{for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>16384){reply(413,{error:'Request too large'});return;}raw+=chunk.toString();}}
  catch{reply(400,{error:'Request body unavailable'});return;}
  let message:any;try{message=JSON.parse(raw);}catch{reply(400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return;}
  const started=Date.now();const response=await rpc(message,authenticated);
  if(message?.method==='tools/call'){
   const result=response.body?.result as {isError?:boolean;structuredContent?:unknown}|undefined;
   const outcome=response.status===401?'unauthorized':response.body?.error?'invalid':result?.isError?'error':toolOutcome(result?.structuredContent);
   // Tool names come from the fixed catalog; unknown arbitrary text is never logged.
   const tool=['list_demo_sites','get_equipment_status','query_telemetry','list_alarms','explain_alarm','get_service_health'].includes(message.params?.name)?message.params.name:'invalid';
   try{insert.run(randomUUID(),new Date().toISOString(),tool,outcome,Date.now()-started);trim.run();}
   catch{console.error(JSON.stringify({event:'audit_unavailable',tool,outcome}));}
  }
  reply(response.status,response.body);
 });
 server.requestTimeout=10000;server.headersTimeout=5000;server.maxRequestsPerSocket=100;
 server.on('close',()=>db.close());
 return server;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const server=createMcpServer({token:process.env.MCP_API_TOKEN??'',database:process.env.AUDIT_DB??'./data/audit.sqlite',allowedOrigins:(process.env.ALLOWED_ORIGINS??'https://yountaehee.github.io').split(',').filter(Boolean)});
 const port=Number(process.env.PORT??3000);const host=process.env.HOST??'127.0.0.1';
 server.listen(port,host,()=>console.log(JSON.stringify({event:'server_started',host,port,data:'synthetic-demo'})));
 for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
}
