import type { loadConfig } from "../lib/config.js";
import { escapeAttribute } from "./html.js";

type AppConfig = Awaited<ReturnType<typeof loadConfig>>;

export function analyticsHead(config: AppConfig): string {
    const gaId = config.analytics?.googleAnalyticsMeasurementId?.trim();
    const gtmId = config.analytics?.googleTagManagerContainerId?.trim();
    const parts: string[] = [];

    if (gaId) {
        const id = escapeAttribute(gaId);

        parts.push(
            `<script async src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>`,
        );
    }

    if (gtmId) {
        const id = escapeAttribute(gtmId);

        parts.push(
            `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>`,
        );
    }

    return parts.join("");
}

export function analyticsBody(config: AppConfig): string {
    const gtmId = config.analytics?.googleTagManagerContainerId?.trim();

    if (!gtmId) return "";

    return `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
}
