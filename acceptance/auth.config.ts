import { requirePrivateReporting } from "./privacy-config";
requirePrivateReporting();
// Retired private Test runner: its late hook/fixture errors can write raw error-context.
throw new Error(
  "Hosted Auth runner disabled pending independent privacy approval; use the synthetic private launcher.",
);
