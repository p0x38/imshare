import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { PushSettings } from "./PushSettings";
import { SecuritySettings } from "./SecuritySettings";

interface Preferences {
    isPublic: boolean;
    followApprovalRequired: boolean;
    showEmail: boolean;
    showPosts: boolean;
    showProfile: boolean;
    showHandle: boolean;
    showFollowers: boolean;
    showFollowings: boolean;
    allowSearchEngineIndex: boolean;
    defaultCategoryId: string | null;
    defaultPostVisibility: "public" | "unlisted" | "private";
    defaultAllowDownload: boolean;
    defaultContentWarning: string | null;
}
interface Category {
    id: string;
    name: string;
}

export function AccountPreferences() {
    const { t } = useTranslation();
    const [preferences, setPreferences] = useState<Preferences | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [tab, setTab] = useState(0);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void Promise.all([
            api<{ data: Preferences }>("/v1/me/preferences"),
            api<{ data: Category[] }>("/v1/categories?limit=100"),
        ])
            .then(([prefs, categoryResponse]) => {
                setPreferences(prefs.data);
                setCategories(categoryResponse.data ?? []);
            })
            .catch((cause) =>
                setError(
                    cause instanceof Error ? cause.message : "Unable to load account preferences.",
                ),
            );
    }, []);

    if (!preferences) return error ? <Alert severity="error">{error}</Alert> : null;
    const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
        setPreferences((current) => (current ? { ...current, [key]: value } : current));
    async function save() {
        setSaving(true);
        setError("");
        try {
            const response = await api<{ data: Preferences }>("/v1/me/preferences", {
                method: "PATCH",
                body: JSON.stringify(preferences),
            });
            setPreferences(response.data);
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : "Unable to save account preferences.",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="h5" component="h2" gutterBottom>
                    {t("accountUi.preferences")}
                </Typography>
                <Tabs
                    value={tab}
                    onChange={(_, value) => setTab(value)}
                    variant="scrollable"
                    allowScrollButtonsMobile
                    sx={{ mb: 2 }}
                >
                    <Tab label={t("accountUi.privacy")} />
                    <Tab label={t("accountUi.postingDefaults")} />
                    <Tab label={t("accountUi.security")} />
                    <Tab label={t("accountUi.notifications")} />
                </Tabs>
                {tab === 0 ? (
                    <Stack spacing={1.25}>
                        <Typography variant="subtitle1">
                            {t("accountUi.profileVisibility")}
                        </Typography>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.showProfile}
                                    onChange={(e) => set("showProfile", e.target.checked)}
                                />
                            }
                            label={t("accountUi.allowProfile")}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.showPosts}
                                    onChange={(e) => set("showPosts", e.target.checked)}
                                />
                            }
                            label={t("accountUi.showPosts")}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.showHandle}
                                    onChange={(e) => set("showHandle", e.target.checked)}
                                />
                            }
                            label={t("accountUi.showHandle")}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.showEmail}
                                    onChange={(e) => set("showEmail", e.target.checked)}
                                />
                            }
                            label={t("accountUi.showEmail")}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.allowSearchEngineIndex}
                                    onChange={(e) =>
                                        set("allowSearchEngineIndex", e.target.checked)
                                    }
                                />
                            }
                            label={t("accountUi.indexProfile")}
                        />
                        <Box sx={{ pt: 1 }}>
                            <Typography variant="subtitle1">
                                {t("accountUi.socialVisibility")}
                            </Typography>
                        </Box>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.isPublic}
                                    onChange={(e) => set("isPublic", e.target.checked)}
                                />
                            }
                            label={t("accountUi.allowFollow")}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.followApprovalRequired}
                                    disabled={!preferences.isPublic}
                                    onChange={(e) =>
                                        set("followApprovalRequired", e.target.checked)
                                    }
                                />
                            }
                            label={t("accountUi.followApproval")}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.showFollowers}
                                    onChange={(e) => set("showFollowers", e.target.checked)}
                                />
                            }
                            label={t("accountUi.showFollowers")}
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.showFollowings}
                                    onChange={(e) => set("showFollowings", e.target.checked)}
                                />
                            }
                            label={t("accountUi.showFollowing")}
                        />
                    </Stack>
                ) : null}
                {tab === 1 ? (
                    <Stack spacing={2}>
                        <FormControl fullWidth>
                            <InputLabel id="default-category-label">
                                {t("accountUi.defaultCategory")}
                            </InputLabel>
                            <Select
                                labelId="default-category-label"
                                label={t("accountUi.defaultCategory")}
                                value={preferences.defaultCategoryId ?? ""}
                                onChange={(e) => set("defaultCategoryId", e.target.value || null)}
                            >
                                <MenuItem value="">{t("accountUi.none")}</MenuItem>
                                {categories.map((category) => (
                                    <MenuItem key={category.id} value={category.id}>
                                        {category.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel id="default-visibility-label">
                                {t("accountUi.defaultVisibility")}
                            </InputLabel>
                            <Select
                                labelId="default-visibility-label"
                                label={t("accountUi.defaultVisibility")}
                                value={preferences.defaultPostVisibility}
                                onChange={(e) =>
                                    set(
                                        "defaultPostVisibility",
                                        e.target.value as Preferences["defaultPostVisibility"],
                                    )
                                }
                            >
                                <MenuItem value="public">{t("accountUi.public")}</MenuItem>
                                <MenuItem value="unlisted">{t("accountUi.unlisted")}</MenuItem>
                                <MenuItem value="private">{t("accountUi.private")}</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={preferences.defaultAllowDownload}
                                    onChange={(e) => set("defaultAllowDownload", e.target.checked)}
                                />
                            }
                            label={t("accountUi.allowDownloads")}
                        />
                        <TextField
                            label={t("accountUi.contentWarning")}
                            value={preferences.defaultContentWarning ?? ""}
                            onChange={(e) => set("defaultContentWarning", e.target.value || null)}
                            inputProps={{ maxLength: 500 }}
                        />
                    </Stack>
                ) : null}
                {tab === 2 ? <SecuritySettings /> : null}
                {tab === 3 ? <PushSettings /> : null}
                {error ? (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                ) : null}
                {tab < 2 ? (
                    <Button
                        variant="contained"
                        onClick={() => void save()}
                        disabled={saving}
                        sx={{ mt: 2 }}
                    >
                        {saving ? t("accountUi.saving") : t("accountUi.save")}
                    </Button>
                ) : null}
            </CardContent>
        </Card>
    );
}
