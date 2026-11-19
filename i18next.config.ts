import { defineConfig } from "i18next-cli";

export default defineConfig({
    locales: ["en", "ja"],
    extract: {
        input: ["src/client/**/*.{ts,tsx}"],
        output: "src/client/locales/{{language}}/{{namespace}}.json",
        defaultNS: "common",
        primaryLanguage: "en",
        secondaryLanguages: ["ja"],
        nsSeparator: ":",
        keySeparator: ".",
    },
    status: {
        checkIdentical: "warn",
    },
    lint: {
        checkTranslationPlaceholders: "error",
        checkConcatenation: "error",
    },
});
