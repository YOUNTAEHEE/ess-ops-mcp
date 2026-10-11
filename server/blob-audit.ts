import {get,list,put} from '@vercel/blob';
import type {AuditEvent,AuditStore} from './vercel.ts';

export function auditPath(event:AuditEvent){
 // Reverse timestamp keys make the lexicographic first page the newest events.
 return `audit/v1/${String(9999999999999-Date.parse(event.createdAt)).padStart(13,'0')}-${event.id}.json`;
}
export class BlobAuditStore implements AuditStore {
 async append(event:AuditEvent){
  await put(auditPath(event),JSON.stringify(event),{access:'private',addRandomSuffix:false,contentType:'application/json',abortSignal:AbortSignal.timeout(4000)});
 }
 async recent(){
  const {blobs}=await list({prefix:'audit/v1/',limit:30,abortSignal:AbortSignal.timeout(4000)});
  const events=await Promise.all(blobs.map(async blob=>{
   const result=await get(blob.pathname,{access:'private',abortSignal:AbortSignal.timeout(4000)});
   if(!result||result.statusCode!==200)throw new Error('Audit record unavailable');
   return await new Response(result.stream).json() as AuditEvent;
  }));
  return events.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 }
}
