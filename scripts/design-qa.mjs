import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
const viewports=process.argv.includes('--quick')?[['desktop',1440,1000]]:[['desktop',1440,1000],['tablet',768,1024],['mobile',390,844]];
const routes=process.argv.includes('--quick')?['/','/app','/app/planner']:['/','/auth','/onboarding','/app','/app/training','/app/planner','/app/evolution-plan','/academy','/competitive/meta','/app/reports','/app/profile','/esports','/admin'];
fs.mkdirSync('artifacts/design/qa',{recursive:true});
for(const [device,width,height] of viewports){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
 const page=await context.newPage();
 await page.goto('http://127.0.0.1:4174/');
 await page.evaluate(async()=>{
   const {demoPlayer}=await import('/src/lib/seed.ts');
   const data=demoPlayer(); data.profile.onboarded=true;
   localStorage.setItem('clutchfolio-demo-v1',JSON.stringify(data));
 });
 await page.getByRole('button',{name:'Explorar demonstração',exact:true}).click();
 await page.getByRole('heading',{name:'Como você joga?'}).waitFor();
 for(const theme of ['dark','light','tidal']){
  await page.evaluate(theme=>localStorage.setItem('clutchfolio-theme',theme),theme);
  for(const route of routes){
   await page.goto('http://127.0.0.1:4174'+route);
   await page.locator('main h1,main h2,main h3').first().waitFor();
   await page.locator('.skeleton-page').waitFor({state:'detached'});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
   const name=`${device}-${theme}-${route.replaceAll('/','_')||'home'}`;
   await page.screenshot({path:`artifacts/design/qa/${name}.png`,fullPage:true});
   results.push({device,theme,route,overflow,violations:axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
   console.log(name,overflow?'OVERFLOW':'fit',axe.violations.map(v=>v.id).join(','));
  }
 }
 await context.close();
}
fs.writeFileSync('artifacts/design/qa/results.json',JSON.stringify(results,null,2));
await browser.close();
if(results.some(r=>r.overflow||r.violations.length))process.exitCode=1;
