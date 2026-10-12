// Browser automation library only: no TestInfo, reporter, hook engine or automatic artifacts.
import { chromium } from 'playwright';
import { phases } from './private-policy.mjs';
const scenario=process.env.KYRVEN_PRIVATE_SCENARIO, marker=process.env.KYRVEN_SYNTHETIC_MARKER;
if(!process.send || !/^FICTITIOUS_[A-Za-z0-9_-]{1,128}$/.test(marker || '')) process.exit(2);
let browser,context,page,failed=false;
const send=(phase,ok)=>process.send?.({type:'result',phase,ok});
for(const phase of phases){
 let ok=true;
 try {
  if (scenario==='worker-crash' && phase==='collection') process.exit(9);
  if (scenario==='unexpected' && phase==='body') {process.send?.({type:'result',phase:marker,ok:true});process.exit(9);}
  if (phase==='setup') {
   browser=await chromium.launch({headless:true});
   context=await browser.newContext({acceptDownloads:false});
   await context.route('**/*',route=>route.abort());
   page=await context.newPage();
   await page.goto('data:text/html,synthetic?token='+marker+'#access_token='+marker);
  }
  if(scenario===phase)throw new Error('https://synthetic.invalid/?token='+marker+'#access_token='+marker);
  if(phase==='body'){
   if(scenario==='timeout')await Promise.race([new Promise(()=>{}),new Promise((_,reject)=>setTimeout(()=>reject(new Error(marker)),100))]);
   if(scenario==='matcher' && new URL(page.url()).pathname!=='/security')throw new Error(marker);
   if(scenario==='console'){console.log(marker);console.error(marker);throw new Error(marker);}
   if(scenario==='attachment')throw new Error('No attachment capability; '+marker);
  }
 }catch{ok=false;failed=true;}
 if(phase==='cleanup'){
  try{await context?.close();await browser?.close();}catch{ok=false;failed=true;}
 }
 send(phase,ok);
}
process.exitCode=failed?1:0;
process.disconnect?.();
