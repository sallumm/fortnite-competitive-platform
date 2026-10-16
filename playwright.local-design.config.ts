import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,workers:2,use:{...base.use,baseURL:'http://127.0.0.1:4174',channel:'msedge'},webServer:undefined});
