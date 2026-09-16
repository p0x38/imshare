import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json" with { type: "json" };
import ja from "./locales/ja.json" with { type: "json" };

const storedLanguage = window.localStorage.getItem("imshare-language");
const language = storedLanguage === "ja" ? "ja" : "en";

void i18n.use(initReactI18next).init({
    resources: {
        en: {
            translation: en,
        },
        ja: {
            translation: ja,
        },
    },
    lng: language,
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
