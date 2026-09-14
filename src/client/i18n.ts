import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
    en: {
        translation: {
            settings: "Settings",
            language: "Language",
            english: "English",
            japanese: "日本語",
            appearance: "Appearance",
            light: "Light",
            dark: "Dark",
            automaticDevice: "Automatic (Device)",
            interfaceAnimations: "Enable interface animations",
            buttonRipple: "Enable button ripple",
            accentColor: "Accent color",
            default: "Default",
            blue: "Blue",
            purple: "Purple",
            green: "Green",
            orange: "Orange",
            settingsSaved: "Settings saved.",
            dashboard: "Dashboard",
            accountProfile: "Account profile",
        },
    },
    ja: {
        translation: {
            settings: "設定",
            language: "言語",
            english: "English",
            japanese: "日本語",
            appearance: "外観",
            light: "ライト",
            dark: "ダーク",
            automaticDevice: "デバイスに合わせる",
            interfaceAnimations: "インターフェースのアニメーションを有効にする",
            buttonRipple: "ボタンのリップルエフェクトを有効にする",
            accentColor: "アクセントカラー",
            default: "デフォルト",
            blue: "青",
            purple: "紫",
            green: "緑",
            orange: "オレンジ",
            settingsSaved: "設定を保存しました。",
            dashboard: "ダッシュボード",
            accountProfile: "アカウントプロフィール",
        },
    },
} as const;

const storedLanguage = window.localStorage.getItem("imshare-language");
const language = storedLanguage === "ja" ? "ja" : "en";

void i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;
