import { test as base, expect } from './private-test';
const marker=process.env.KYRVEN_FAKE_REDACTION_MARKER!;
const scenario=process.env.A2422_SCENARIO;
if(scenario==='collection')throw new Error(`https://synthetic.invalid/?token=${marker}#access_token=${marker}`);
if(scenario==='beforeAll')base.beforeAll(async()=>{throw new Error(marker);});
if(scenario==='afterAll')base.afterAll(async()=>{throw new Error(marker);});
const test=base.extend<{adversarial:boolean}>({adversarial:async({page},use)=>{
 if(scenario==='setup')throw new Error(marker);
 await page.goto(`data:text/html,synthetic?token=${marker}#access_token=${marker}`);
 await use(true);
 if(scenario==='teardown')throw new Error(`https://synthetic.invalid/?token=${marker}#access_token=${marker}`);
}});
test('Unexpected lifecycle failure',async({adversarial})=>{expect(adversarial).toBe(true);});
