import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

// Run `ANALYZE=true npm run build` to open the bundle treemap in a browser.
// The analyzer is a no-op in all other environments so it is safe to leave wired.
const analyze = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const withNextIntl = createNextIntlPlugin("./i18n.config.ts");

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default analyze(
  withNextIntl(
    withSentryConfig(nextConfig, {
      // Suppresses Sentry CLI output during build
      silent: !process.env.CI,
      // Upload source maps only when SENTRY_AUTH_TOKEN is present
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Disable source map upload if auth token is not configured
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
      // Automatically instrument Next.js data fetching methods
      autoInstrumentServerFunctions: true,
    }),
  ),
);
