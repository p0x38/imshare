import eslint from "@eslint/js";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "uploads/**",
      "public/**",
      ".history/**",
      "**/*.ts",
    ],
  },
  eslint.configs.recommended,
];
