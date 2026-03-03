import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Allow setState in effects — standard SSR theme-loading pattern
      "react-hooks/set-state-in-effect": "off",
      // Allow self-referencing callbacks (animation loops, recursive timers)
      "react-hooks/immutability": "off",
      // Allow ref assignment during render (sync pattern for useCallback refs)
      "react-hooks/refs": "off",
      // Allow Date.now() in useRef initial value
      "react-hooks/purity": "off",
      // Quotes and apostrophes in JSX text are safe
      "react/no-unescaped-entities": "off",
      // Allow `any` for browser APIs (SpeechRecognition, AudioContext, MediaPipe)
      "@typescript-eslint/no-explicit-any": "off",
      // Allow underscore-prefixed unused vars (intentional destructure exclusion)
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
