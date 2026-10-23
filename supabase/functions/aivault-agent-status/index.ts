import {protect} from '../_shared/media-auth.mjs';
import {createStatus} from './status.mjs';
const handler=createStatus({env:(name:string)=>Deno.env.get(name)});
Deno.serve(protect(async () => {
  const response=await handler();
  const headers=new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin','https://nl13741619-commits.github.io');
  headers.set('Vary','Origin');
  return new Response(response.body,{status:response.status,headers});
}));
