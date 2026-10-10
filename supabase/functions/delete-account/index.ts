import {createClient} from 'npm:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')||'http://localhost:5173','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
Deno.serve(async(req:Request)=>{
 const respond=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return respond({error:'Method not allowed'},405);
 if(req.headers.get('origin')&&req.headers.get('origin')!==cors['Access-Control-Allow-Origin'])return respond({error:'Origin not allowed'},403);
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return respond({error:'Authentication required'},401);
 try{
 const url=Deno.env.get('SUPABASE_URL')!;const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.auth.getUser(token);if(error||!data.user)return respond({error:'Invalid session'},401);
 if(Date.now()/1000-(data.user.last_sign_in_at?Date.parse(data.user.last_sign_in_at)/1000:0)>900)return respond({error:'Sign in again before deleting your account'},403);
 const body=await req.json();if(body.confirmation!=='EXCLUIR')return respond({error:'Confirmation required'},400);
 const deleted=await admin.auth.admin.deleteUser(data.user.id);if(deleted.error)return respond({error:'Account deletion failed'},500);
 return respond({deleted:true},200);
 }catch{return respond({error:'Deletion unavailable'},500);}
});
