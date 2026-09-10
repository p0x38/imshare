import eslint from "@eslint/js";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "uploads/**", "public/**"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
];
