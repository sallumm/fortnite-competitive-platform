// Fail before reading private fixtures; never echo an unsafe argument/environment value.
export function requirePrivateReporting() {
  if (
    Object.keys(process.env).some(key => process.env[key] && !['PLAYWRIGHT_NO_COPY_PROMPT','PWD'].includes(key.toUpperCase()) && /^(DEBUG|NODE_OPTIONS|NODE_DEBUG|PW.*|PLAYWRIGHT.*)$/.test(key.toUpperCase())) ||
    process.argv.some((value) =>
      /^(--debug|--trace|--reporter|--add-reporter)(=|$)/.test(value),
    )
  )
    throw new Error(
      "Private Auth requires its restricted reporter and recording settings; debug/trace/reporter overrides are blocked.",
    );
}
