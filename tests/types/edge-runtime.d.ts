// Static check for the two Deno APIs used by the entry point. Deployment remains a separate check.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
