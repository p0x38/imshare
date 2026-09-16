import {
    Alert,
    Button,
    Card,
    CardContent,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    Stack,
    Switch,
    Typography,
} from "@mui/material";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App, useColorMode, useLanguage, useThemeSettings } from "../components/App";
import "../i18n";
import type { AccentColor } from "../theme";
import { Page } from "../components/Page";

function SettingsPage() {
    const { t } = useTranslation();
    const { preference, setPreference } = useColorMode();
    const { language, setLanguage } = useLanguage();
    const { settings, setAnimations, setRipple, setAccentColor } = useThemeSettings();
    const [saved, setSaved] = useState(false);

    const saveNotice = () => setSaved(true);

    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">
                    {t("settings")}
                </Typography>
                {saved ? (
                    <Alert severity="success" onClose={() => setSaved(false)}>
                        {t("settingsSaved")}
                    </Alert>
                ) : null}
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6" component="h2">
                                {t("language")}
                            </Typography>
                            <FormControl>
                                <RadioGroup
                                    aria-label={t("language")}
                                    value={language}
                                    onChange={(event) => {
                                        setLanguage(event.target.value as "en" | "ja");
                                        saveNotice();
                                    }}
                                >
                                    <FormControlLabel
                                        value="en"
                                        control={<Radio />}
                                        label={t("english")}
                                    />
                                    <FormControlLabel
                                        value="ja"
                                        control={<Radio />}
                                        label={t("japanese")}
                                    />
                                </RadioGroup>
                            </FormControl>
                            <Typography variant="h6" component="h2">
                                {t("appearance")}
                            </Typography>
                            <FormControl>
                                <RadioGroup
                                    value={preference}
                                    onChange={(event) => {
                                        setPreference(
                                            event.target.value as "light" | "dark" | "auto",
                                        );
                                        saveNotice();
                                    }}
                                >
                                    <FormControlLabel
                                        value="light"
                                        control={<Radio />}
                                        label={t("light")}
                                    />
                                    <FormControlLabel
                                        value="dark"
                                        control={<Radio />}
                                        label={t("dark")}
                                    />
                                    <FormControlLabel
                                        value="auto"
                                        control={<Radio />}
                                        label={t("automaticDevice")}
                                    />
                                </RadioGroup>
                            </FormControl>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.animations}
                                        onChange={(event) => {
                                            setAnimations(event.target.checked);
                                            saveNotice();
                                        }}
                                    />
                                }
                                label={t("interfaceAnimations")}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.ripple}
                                        onChange={(event) => {
                                            setRipple(event.target.checked);
                                            saveNotice();
                                        }}
                                    />
                                }
                                label={t("buttonRipple")}
                            />
                            <FormControl>
                                <Typography variant="subtitle2" gutterBottom>
                                    {t("accentColor")}
                                </Typography>
                                <RadioGroup
                                    row
                                    value={settings.accentColor}
                                    onChange={(event) => {
                                        setAccentColor(event.target.value as AccentColor);
                                        saveNotice();
                                    }}
                                >
                                    <FormControlLabel
                                        value="default"
                                        control={<Radio />}
                                        label={t("default")}
                                    />
                                    <FormControlLabel
                                        value="blue"
                                        control={<Radio />}
                                        label={t("blue")}
                                    />
                                    <FormControlLabel
                                        value="purple"
                                        control={<Radio />}
                                        label={t("purple")}
                                    />
                                    <FormControlLabel
                                        value="green"
                                        control={<Radio />}
                                        label={t("green")}
                                    />
                                    <FormControlLabel
                                        value="orange"
                                        control={<Radio />}
                                        label={t("orange")}
                                    />
                                </RadioGroup>
                            </FormControl>
                        </Stack>
                    </CardContent>
                </Card>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" component="a" href="/dashboard/">
                        {t("dashboard")}
                    </Button>
                    <Button component="a" href="/account/">
                        {t("accountProfile")}
                    </Button>
                </Stack>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#settings-page");
if (root)
    createRoot(root).render(
        <App>
            <SettingsPage />
        </App>,
    );
