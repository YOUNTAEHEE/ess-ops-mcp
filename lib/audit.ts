import {getDb} from '@/db';
import {requestAudit} from '@/db/schema';
import {desc} from 'drizzle-orm';
export async function recordAudit(tool:string,outcome:string,durationMs:number){
 const id=crypto.randomUUID();const createdAt=new Date().toISOString();
 try{await getDb().insert(requestAudit).values({id,createdAt,tool:tool.slice(0,100),outcome,durationMs});return {persisted:true,id};}
 catch{console.error(JSON.stringify({event:'audit_unavailable',tool,outcome,durationMs}));return {persisted:false,id};}
}
export async function recentAudit(){try{return {persisted:true,events:await getDb().select().from(requestAudit).orderBy(desc(requestAudit.createdAt)).limit(30)};}catch{return {persisted:false,events:[]};}}
