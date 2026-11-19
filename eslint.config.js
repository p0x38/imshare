import eslint from "@eslint/js";
import i18next from "eslint-plugin-i18next";
import tseslint from "typescript-eslint";

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
    {
        files: ["src/client/**/*.tsx"],
        languageOptions: {
            parser: tseslint.parser,
        },
        rules: { "no-undef": "off" },
    },
    i18next.configs["flat/recommended"],
    {
        files: ["src/client/**/*.{ts,tsx}"],
        rules: { "i18next/no-literal-string": ["error", { mode: "all" }] },
    },
];
