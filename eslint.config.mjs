import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // eslint-plugin-react-hooks v7 ke strict rules legacy codebase (fetch-in-effect
    // pattern) ke saath conflict karte hain — off kar diya hai. Isko gradually
    // re-enable karna hai jab pages React 19 recommended data patterns par shift
    // hon (use()/suspense ya data fetching library).
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    // ESLint 10 ne react version auto-detection ka API (context.getFilename)
    // remove kar diya — plugin crash hota hai. Explicit version set karke
    // bypass kiya ja raha hai.
    settings: {
      react: { version: "19" },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Dev/ops tooling — app source nahi hai (CommonJS scripts + throwaway scratch):
    "scripts/**",
    "scratch/**",
    "backups/**",
    "mariadb dump/**",
  ]),
]);

export default eslintConfig;
