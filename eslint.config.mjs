import { defineConfig, globalIgnores } from "eslint/config"
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // Existing components contain 75 synchronous state resets in effects. Keep
      // reporting them while remediation is tracked, without blocking the initial
      // restoration of the lint gate.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "dist/**",
    "coverage/**",
    "public/uploads/**",
    "uploads/**",
    "addons/.runtime/**",
    "addons/.staging/**",
    "addons/.trash/**",
  ]),
])
