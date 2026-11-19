import { useState } from "react";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControlLabel,
    Paper,
    Stack,
    Switch,
    Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { hasAnalyticsConfiguration, updateAnalyticsConsent } from "../lib/analytics";

type ConsentChoice = "accepted" | "rejected" | null;

const CONSENT_STORAGE_KEY = "imshare-analytics-consent-v1";

function readConsentChoice(): ConsentChoice {
    try {
        const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);

        if (value === "accepted" || value === "rejected") return value;
    } catch {
        // Ask again when browser storage is unavailable.
    }

    return null;
}

export function CookieConsent() {
    const { t } = useTranslation(["privacy"]);
    const [choice, setChoice] = useState<ConsentChoice>(readConsentChoice);
    const [analyticsEnabled, setAnalyticsEnabled] = useState(choice === "accepted");
    const [settingsOpen, setSettingsOpen] = useState(false);

    if (!hasAnalyticsConfiguration()) return null;

    function saveChoice(allowed: boolean) {
        const nextChoice: ConsentChoice = allowed ? "accepted" : "rejected";

        try {
            window.localStorage.setItem(CONSENT_STORAGE_KEY, nextChoice);
        } catch {
            // The current choice still applies to this page session.
        }

        updateAnalyticsConsent(allowed);

        setAnalyticsEnabled(allowed);
        setChoice(nextChoice);
        setSettingsOpen(false);
    }

    function openSettings() {
        setAnalyticsEnabled(choice === "accepted");
        setSettingsOpen(true);
    }

    return (
        <>
            {choice === null ? (
                <Box
                    sx={{
                        position: "fixed",
                        left: 1.5,
                        right: 1.5,
                        bottom: 1.5,
                        zIndex: (theme) => theme.zIndex.snackbar,
                        display: "flex",
                        justifyContent: "center",
                        pointerEvents: "none",
                    }}
                >
                    <Paper
                        role="region"
                        aria-label={t("privacyConsent.title")}
                        elevation={8}
                        sx={{
                            width: "min(760px, 100%)",
                            p: { xs: 2, sm: 2.5 },
                            border: 1,
                            borderColor: "divider",
                            pointerEvents: "auto",
                        }}
                    >
                        <Stack spacing={1.5}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                {t("privacyConsent.title")}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t("privacyConsent.message")}
                            </Typography>
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                justifyContent="flex-end"
                            >
                                <Button variant="outlined" onClick={() => saveChoice(true)}>
                                    {t("privacyConsent.allow")}
                                </Button>
                                <Button variant="outlined" onClick={() => saveChoice(false)}>
                                    {t("privacyConsent.reject")}
                                </Button>
                                <Button variant="text" onClick={openSettings}>
                                    {t("privacyConsent.customize")}
                                </Button>
                            </Stack>
                        </Stack>
                    </Paper>
                </Box>
            ) : (
                <Box
                    sx={{
                        position: "fixed",
                        right: 2,
                        bottom: 2,
                        zIndex: (theme) => theme.zIndex.snackbar,
                    }}
                >
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={openSettings}
                        sx={{ bgcolor: "background.paper" }}
                    >
                        {t("privacyConsent.settings")}
                    </Button>
                </Box>
            )}

            <Dialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                fullWidth
                maxWidth="sm"
                aria-labelledby="privacy-consent-dialog-title"
            >
                <DialogTitle id="privacy-consent-dialog-title">
                    {t("privacyConsent.title")}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2}>
                        <DialogContentText>{t("privacyConsent.details")}</DialogContentText>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={analyticsEnabled}
                                    onChange={(event) => setAnalyticsEnabled(event.target.checked)}
                                />
                            }
                            label={t("privacyConsent.analytics")}
                        />
                        <Typography variant="body2" color="text.secondary">
                            {t("privacyConsent.analyticsHelp")}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ flexWrap: "wrap", px: 3, pb: 2 }}>
                    <Button onClick={() => saveChoice(false)}>{t("privacyConsent.reject")}</Button>
                    <Button onClick={() => saveChoice(true)} variant="outlined">
                        {t("privacyConsent.allow")}
                    </Button>
                    <Button onClick={() => saveChoice(analyticsEnabled)} variant="contained">
                        {t("privacyConsent.save")}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
