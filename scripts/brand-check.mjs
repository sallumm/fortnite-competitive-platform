import { readdirSync, readFileSync } from 'node:fs';
// These technical keys preserve existing sessions/preferences and deployment contracts.
const allowed = /localStorage|const (KEY|DEMO_ACTIVE|key)|clutchfolio-|clutch-coach|startsWith\("Clutchfolio:|replace\(\/\^Clutchfolio:|replace\(\/Clutchfolio|Clutchfolio\/gi|Clutch Coach\/g|\.startsWith\("clutchfolio|storage|project_id/;
let failures = [];
function scan(dir) { for(const d of readdirSync(dir,{withFileTypes:true})) {const path=dir+'/'+d.name;if(d.isDirectory())scan(path);else if(/\.(tsx?|json|html|svg|css)$/.test(path))readFileSync(path,'utf8').split('\n').forEach((s,i)=>{if(/Clutchfolio|Clutch Coach/.test(s)&&!allowed.test(s)&&!s.trim().startsWith('/*'))failures.push(path+':'+(i+1));});}}
scan('src');scan('public');
if(failures.length){console.error('Historical branding requires review:',failures);process.exit(1);}console.log('Public kyrven branding checked; technical compatibility keys retained.');
