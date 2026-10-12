import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";
// An allowlist reporter: never serializes errors, titles, URLs, attachments or worker output.
// Framework timeouts and cleanup/startup failures also pass through this boundary.
export default class SafeAuthReporter implements Reporter {
  private count = 0;
  onTestEnd(_test: TestCase, result: TestResult) {
    const status = [
      "passed",
      "failed",
      "timedOut",
      "skipped",
      "interrupted",
    ].includes(result.status)
      ? result.status
      : "failed";
    console.log(`Private Auth case ${++this.count}: ${status}`);
  }
  onError() {
    console.log("Private Auth runner error; details suppressed.");
  }
  onStdOut() {
    /* Untrusted worker output is intentionally discarded. */
  }
  onStdErr() {
    /* Untrusted worker output is intentionally discarded. */
  }
  onEnd(result: FullResult) {
    console.log(`Private Auth run: ${result.status}`);
  }
  printsToStdio() {
    return true;
  }
}
