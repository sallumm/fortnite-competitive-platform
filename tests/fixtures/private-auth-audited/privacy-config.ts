// Fail before reading private fixtures; never echo an unsafe argument/environment value.
export function requirePrivateReporting() {
  if (
    process.env.DEBUG ||
    process.env.PWDEBUG ||
    process.argv.some((value) =>
      /^(--debug|--trace|--reporter)(=|$)/.test(value),
    )
  )
    throw new Error(
      "Private Auth requires its restricted reporter and recording settings; debug/trace/reporter overrides are blocked.",
    );
}
