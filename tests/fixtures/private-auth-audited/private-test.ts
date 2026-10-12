import { test as base, expect } from "@playwright/test";
export const test = base;
export { expect };
// Runs before Playwright writes error-context artifacts, including unwrapped assertions.
test.afterEach(async ({}, info) => {
  for (const error of info.errors) {
    error.message = "Private Auth failure; details suppressed.";
    error.stack = error.message;
    delete (error as { snippet?: string }).snippet;
    delete (error as { errorContext?: string }).errorContext;
  }
});
