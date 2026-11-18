import type { loadConfig } from "../lib/config.js";
import { escapeAttribute } from "./html.js";

type AppConfig = Awaited<ReturnType<typeof loadConfig>>;

export function analyticsConfigHead(config: AppConfig): string {
    const configuredGaId = config.analytics?.googleAnalyticsMeasurementId?.trim();
    const configuredGtmId = config.analytics?.googleTagManagerContainerId?.trim();

    const gaId =
        configuredGaId && /^G-[A-Z0-9]+$/i.test(configuredGaId) ? configuredGaId : undefined;

    const gtmId =
        configuredGtmId && /^GTM-[A-Z0-9]+$/i.test(configuredGtmId) ? configuredGtmId : undefined;

    if (!gaId && !gtmId) return "";

    const metadata = [
        '<meta name="imshare-analytics-config"',
        ` data-ga-id="${escapeAttribute(gaId ?? "")}"`,
        ` data-gtm-id="${escapeAttribute(gtmId ?? "")}">`,
    ].join("");

    const bootstrap = `
<script>
    (function () {
        var config = document.querySelector('meta[name="imshare-analytics-config"]');
        if (!config) return;

        var gaId = config.dataset.gaId || "";
        var gtmId = config.dataset.gtmId || "";
        var analyticsConsent = "denied";

        try {
            if (window.localStorage.getItem("imshare-analytics-consent-v1") === "accepted") {
                analyticsConsent = "granted";
            }
        } catch {}

        window.dataLayer = window.dataLayer || [];

        function gtag() {
            window.dataLayer.push(arguments);
        }

        window.gtag = window.gtag || gtag;

        window.gtag("consent", "default", {
            analytics_storage: analyticsConsent,
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied"
        });

        window.gtag("set", "ads_data_redaction", true);
        window.gtag("js", new Date());

        if (gaId) {
            window.gtag("config", gaId);

            var gaScript = document.createElement("script");
            gaScript.async = true;
            gaScript.src =
                "https://www.googletagmanager.com/gtag/js?id=" +
                encodeURIComponent(gaId);
            
            document.head.appendChild(gaScript);
        }
        
        if (gtmId) {
            window.dataLayer.push({
                "gtm.start": new Date().getTime(),
                event: "gtm.js"
            });

            var gtmScript = document.createElement("script");
            gtmScript.async = true;
            gtmScript.src =
                "https://www.googletagmanager.com/gtm.js?id=" +
                encodeURIComponent(gtmId);
            
            document.head.appendChild(gtmScript);
        }
    })();
</script>`;

    return metadata + bootstrap;
}
