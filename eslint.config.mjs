import globals from "globals";
import js from "@eslint/js";
import eslintPluginJest from "eslint-plugin-jest";
/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      jest: eslintPluginJest,
    },
    rules: {
      ...eslintPluginJest.configs.recommended.rules,
    },
  },
  js.configs.recommended,
];