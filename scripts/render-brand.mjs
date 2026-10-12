import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext();
const page=await context.newPage();
for(const [source,destination,width,height] of [
 ['avatar','icon-192',192,192],['avatar','icon-512',512,512],['avatar','apple-touch-icon',180,180],
 ['social','social',1200,630],['avatar','avatar',512,512],['discord-banner','discord-banner',960,540],
 ['post','post',1080,1080],['vertical','vertical',1080,1920],['youtube-cover','youtube-cover',2560,1440],
 ['jersey','jersey',960,720],['jersey-mono','jersey-mono',960,720],['directions','directions',1440,680]
]){
 await page.setViewportSize({width,height});
 const svg=fs.readFileSync(`public/brand/${source}.svg`,'utf8');
 await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{width:100%;height:100%}</style>${svg}`);
 await page.screenshot({path:`public/brand/${destination}.png`,omitBackground:true});
}
await browser.close();
