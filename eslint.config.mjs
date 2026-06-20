import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Issue #8: tighten the jsx-a11y ruleset that eslint-config-next/core-web-
  // vitals already registers, so accessibility regressions are caught at
  // lint time instead of slipping through to a manual audit. These rules
  // matter for a money-handling app — keyboard equivalents on interactive
  // controls, labels on form inputs, and a guard against the
  // "div with onClick" pattern that mouse-only users can hit but
  // keyboard users can't.
  {
    rules: {
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/anchor-is-valid": "error",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
