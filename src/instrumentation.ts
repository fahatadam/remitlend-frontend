export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Type definitions matching Sentry's captureRequestError signature
interface RequestInfo {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

interface ErrorContext {
  routerKind: string;
  routePath: string;
  routeType: string;
}

// Type-safe handler for Next.js onRequestError instrumentation hook
// See: https://nextjs.org/docs/app/api-reference/functions/instrumentation#onrequesterror
export const onRequestError = async (
  error: unknown,
  request: RequestInfo,
  errorContext: ErrorContext,
): Promise<void> => {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(error, request, errorContext);
};
