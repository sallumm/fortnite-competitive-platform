import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
const files = execFileSync("git", ["ls-files", "-z"], {encoding:"utf8"}).split("\0").filter(Boolean);
const issues=[];
const patterns=[/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{60,}/,/sk-(?:proj-)?[A-Za-z0-9_-]{40,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/sb_secret_[A-Za-z0-9_-]{20,}/];
for(const file of files) {
 if(!fs.existsSync(file))continue;
 const text=fs.readFileSync(file,"utf8");
 if(patterns.some(pattern=>pattern.test(text)))issues.push(`${file}: possible credential (value withheld)`);
 for(const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)||[]) {
  try{if(JSON.parse(Buffer.from(token.split('.')[1],"base64url")).role==='service_role')issues.push(`${file}: privileged JWT (value withheld)`);}catch{}
 }
 if(file.startsWith('.github/workflows/') && /uses:\s+[^\s]+@(?![a-f0-9]{40}(?:\s|$))/m.test(text))issues.push(`${file}: action must use a full commit SHA`);
}
const manifest=JSON.parse(fs.readFileSync('scripts/migrations-001-028.sha256.json','utf8'));
for(const [file,expected] of Object.entries(manifest)) {
 const value=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 if(crypto.createHash('sha256').update(value).digest('hex')!==expected)issues.push(`${file}: historical migration changed`);
}
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}
else console.info(`Security static checks passed: ${files.length} tracked files, 28 historical migrations, pinned actions. Pattern scan is not a complete secret scanner or a security audit.`);
