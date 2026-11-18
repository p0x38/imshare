declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

export function hasAnalyticsConfiguration(): boolean {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="imshare-analytics-config"]');

    return Boolean(meta?.dataset.gaId || meta?.dataset.gtmId);
}

export function updateAnalyticsConsent(allowed: boolean): void {
    window.gtag?.("consent", "update", {
        analytics_storage: allowed ? "granted" : "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
    });
}
