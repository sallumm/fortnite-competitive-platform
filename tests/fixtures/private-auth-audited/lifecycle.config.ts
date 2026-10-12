import { defineConfig } from '@playwright/test';
import { requirePrivateReporting } from './privacy-config';
requirePrivateReporting();process.env.PLAYWRIGHT_NO_COPY_PROMPT='1';
export default defineConfig({testDir:'.',testMatch:'lifecycle.spec.ts',reporter:[['./safe-reporter.ts']],workers:1,retries:0,timeout:1000,use:{trace:'off',screenshot:'off',video:'off'}});
