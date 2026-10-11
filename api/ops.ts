import {BlobAuditStore} from '../server/blob-audit';
import {createVercelHandler} from '../server/vercel.mts';

const handler=createVercelHandler({token:process.env.MCP_API_TOKEN??'',store:new BlobAuditStore(),allowedOrigins:(process.env.ALLOWED_ORIGINS??'').split(',').filter(Boolean)});
export default {fetch(request:Request){
 return handler(request,new URL(request.url).searchParams.get('route')??'');
}};
