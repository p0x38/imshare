import i18n from "i18next";
import type { BackendModule, ResourceKey } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";

const translationModules = import.meta.glob<Record<string, unknown>>("./locales/*/*.json", {
    import: "default",
});

const supportedLanguages = Array.from(
    new Set(
        Object.keys(translationModules)
            .map((path) => path.split("/")[2])
            .filter((language): language is string => Boolean(language)),
    ),
);

if (supportedLanguages.length === 0)
    throw new Error("No translation resources were found in src/client/locales.");

const fallbackLanguage = supportedLanguages.includes("en") ? "en" : supportedLanguages[0]!;

const storedLanguage = window.localStorage.getItem("imshare-language");
const language =
    storedLanguage && supportedLanguages.includes(storedLanguage)
        ? storedLanguage
        : fallbackLanguage;

const translationBackend: BackendModule = {
    type: "backend",
    init: () => undefined,
    read(language, namespace, callback) {
        const path = `./locales/${language}/${namespace}.json`;
        const load = translationModules[path];

        if (!load) {
            callback(new Error(`Translation resource not found: ${path}`), false);
            return;
        }

        void load().then(
            (translations) => callback(null, translations as ResourceKey),
            (cause: unknown) =>
                callback(
                    cause instanceof Error
                        ? cause
                        : new Error(`Unable to load translation resource: ${path}`),
                    false,
                ),
        );
    },
};

void i18n
    .use(translationBackend)
    .use(initReactI18next)
    .init({
        lng: language,
        supportedLngs: supportedLanguages,
        fallbackLng: fallbackLanguage,
        defaultNS: "common",
        ns: ["common"],
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
