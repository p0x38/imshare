import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json" with { type: "json" };
import enCommunityFaq from "./locales/faq-community.en.json" with { type: "json" };
import ja from "./locales/ja.json" with { type: "json" };
import jaCommunityFaq from "./locales/faq-community.ja.json" with { type: "json" };

const storedLanguage = window.localStorage.getItem("imshare-language");
const language = storedLanguage === "ja" ? "ja" : "en";

void i18n.use(initReactI18next).init({
    resources: {
        en: {
            translation: {
                ...en,
                faq: {
                    ...en.faq,
                    community: enCommunityFaq,
                },
            },
        },
        ja: {
            translation: {
                ...ja,
                faq: {
                    ...ja.faq,
                    community: jaCommunityFaq,
                },
            },
        },
    },
    lng: language,
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
