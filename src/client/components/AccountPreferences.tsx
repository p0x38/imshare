import { Alert, Button, Card, CardContent, Checkbox, FormControlLabel, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Preferences {
    isPublic: boolean;
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
interface Category { id: string; name: string }

export function AccountPreferences() {
    const [preferences, setPreferences] = useState<Preferences | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void Promise.all([
            api<{ data: Preferences }>("/v1/me/preferences"),
            api<{ data: Category[] }>("/v1/categories?limit=100"),
        ]).then(([prefs, categoryResponse]) => {
            setPreferences(prefs.data);
            setCategories(categoryResponse.data ?? []);
        }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load account preferences."));
    }, []);

    if (!preferences) return error ? <Alert severity="error">{error}</Alert> : null;

    const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences((current) => current ? { ...current, [key]: value } : current);
    async function save() {
        setSaving(true);
        setError("");
        try {
            const response = await api<{ data: Preferences }>("/v1/me/preferences", { method: "PATCH", body: JSON.stringify(preferences) });
            setPreferences(response.data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save account preferences.");
        } finally { setSaving(false); }
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Typography variant="h6" component="h2">Privacy & posting defaults</Typography>
                    <FormControlLabel control={<Checkbox checked={preferences.showProfile} onChange={(e) => set("showProfile", e.target.checked)} />} label="Allow other users to see your profile" />
                    <FormControlLabel control={<Checkbox checked={preferences.showFollowers} onChange={(e) => set("showFollowers", e.target.checked)} />} label="Allow other users to see your followers" />
                    <FormControlLabel control={<Checkbox checked={preferences.showFollowings} onChange={(e) => set("showFollowings", e.target.checked)} />} label="Allow other users to see who you follow" />
                    <FormControlLabel control={<Checkbox checked={preferences.showHandle} onChange={(e) => set("showHandle", e.target.checked)} />} label="Show your custom handle publicly" />
                    <FormControlLabel control={<Checkbox checked={preferences.showPosts} onChange={(e) => set("showPosts", e.target.checked)} />} label="Show your public posts on your profile" />
                    <FormControlLabel control={<Checkbox checked={preferences.allowSearchEngineIndex} onChange={(e) => set("allowSearchEngineIndex", e.target.checked)} />} label="Allow search engines to index your profile" />
                    <FormControlLabel control={<Checkbox checked={preferences.isPublic} onChange={(e) => set("isPublic", e.target.checked)} />} label="Allow people to follow you" />
                    <FormControl fullWidth>
                        <InputLabel id="default-category-label">Default category</InputLabel>
                        <Select labelId="default-category-label" label="Default category" value={preferences.defaultCategoryId ?? ""} onChange={(e) => set("defaultCategoryId", e.target.value || null)}>
                            <MenuItem value="">None</MenuItem>
                            {categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel id="default-visibility-label">Default post visibility</InputLabel>
                        <Select labelId="default-visibility-label" label="Default post visibility" value={preferences.defaultPostVisibility} onChange={(e) => set("defaultPostVisibility", e.target.value as Preferences["defaultPostVisibility"]) }>
                            <MenuItem value="public">Public</MenuItem>
                            <MenuItem value="unlisted">Unlisted</MenuItem>
                            <MenuItem value="private">Private</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControlLabel control={<Checkbox checked={preferences.defaultAllowDownload} onChange={(e) => set("defaultAllowDownload", e.target.checked)} />} label="Allow downloads by default" />
                    <TextField label="Default content warning" value={preferences.defaultContentWarning ?? ""} onChange={(e) => set("defaultContentWarning", e.target.value || null)} inputProps={{ maxLength: 500 }} />
                    {error ? <Alert severity="error">{error}</Alert> : null}
                    <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save privacy & defaults"}</Button>
                </Stack>
            </CardContent>
        </Card>
    );
}
