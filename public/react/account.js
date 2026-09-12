import { useEffect, useState } from "https://esm.sh/react@19.1.1?target=es2022";
import {
    Alert,
    Avatar,
    Button,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "https://esm.sh/@mui/material@9.4.0?bundle&external=react,react-dom&target=es2022";
import { api, h, LoadingState, mount, notify, Page } from "/react/core.js";

function AccountPage() {
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [linkSaving, setLinkSaving] = useState(false);
    const [name, setName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarMode, setAvatarMode] = useState("initials");
    const [avatarValue, setAvatarValue] = useState("");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [githubUrl, setGithubUrl] = useState("");
    const [linkLabel, setLinkLabel] = useState("");
    const [linkUrl, setLinkUrl] = useState("");

    const load = async () => {
        try {
            const response = await api("/v1/me");
            const next = response.data;
            setUser(next);
            setName(next?.name || "");
            setBio(next?.bio || "");
            setAvatarMode(next?.avatarMode || "initials");
            setAvatarValue(next?.avatarValue || "");
            setWebsiteUrl(next?.websiteUrl || "");
            setGithubUrl(next?.githubUrl || "");
        } catch (cause) {
            if (cause?.status === 401) {
                setUser(false);
                return;
            }
            setError(cause instanceof Error ? cause.message : "Unable to load account information.");
        }
    };

    useEffect(() => {
        load();
    }, []);

    if (error) return h(Page, null, h(Alert, { severity: "error" }, error));
    if (user === null) return h(Page, null, h(LoadingState, { label: "Loading account…" }));
    if (user === false) {
        return h(
            Page,
            null,
            h(
                Card,
                { variant: "outlined" },
                h(
                    CardContent,
                    null,
                    h(Typography, { variant: "h4", component: "h1", gutterBottom: true }, "Account"),
                    h(Typography, { paragraph: true }, "You are not signed in."),
                    h(Button, { variant: "contained", component: "a", href: "/account/login/" }, "Log in"),
                    h(Button, { component: "a", href: "/account/register/", sx: { ml: 1 } }, "Create account"),
                ),
            ),
        );
    }

    const saveProfile = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            await api(`/v1/users/${encodeURIComponent(user.id)}`, {
                method: "PATCH",
                body: JSON.stringify({
                    name,
                    bio: bio || null,
                    websiteUrl: websiteUrl || null,
                    githubUrl: githubUrl || null,
                    avatarMode,
                    avatarValue: avatarValue || null,
                }),
            });
            notify("Profile saved.", "success");
            await load();
        } catch (cause) {
            notify(cause instanceof Error ? cause.message : "Unable to save profile.", "error");
        } finally {
            setSaving(false);
        }
    };

    const addLink = async (event) => {
        event.preventDefault();
        setLinkSaving(true);
        try {
            await api("/v1/me/links", {
                method: "POST",
                body: JSON.stringify({ label: linkLabel, url: linkUrl }),
            });
            setLinkLabel("");
            setLinkUrl("");
            notify("Profile link added.", "success");
            await load();
        } catch (cause) {
            notify(cause instanceof Error ? cause.message : "Unable to add profile link.", "error");
        } finally {
            setLinkSaving(false);
        }
    };

    const removeLink = async (id) => {
        if (!window.confirm("Remove this profile link?")) return;
        try {
            await api(`/v1/me/links/${encodeURIComponent(id)}`, { method: "DELETE" });
            notify("Profile link removed.", "success");
            await load();
        } catch (cause) {
            notify(cause instanceof Error ? cause.message : "Unable to remove profile link.", "error");
        }
    };

    return h(
        Page,
        null,
        h(
            Stack,
            { spacing: 2 },
            h(Typography, { variant: "h4", component: "h1" }, "Account"),
            h(
                Card,
                { variant: "outlined" },
                h(
                    CardContent,
                    null,
                    h(Stack, { direction: "row", spacing: 2, alignItems: "center" },
                        h(Avatar, { src: user.avatarUrl, sx: { width: 80, height: 80 } }, (user.name || "A").charAt(0).toUpperCase()),
                        h(Stack, { spacing: 0.25 },
                            h(Typography, { variant: "h6" }, user.name || "Account"),
                            h(Typography, { color: "text.secondary" }, user.email || ""),
                        ),
                    ),
                ),
            ),
            h(
                Card,
                { variant: "outlined", component: "form", onSubmit: saveProfile },
                h(
                    CardContent,
                    null,
                    h(Typography, { variant: "h6", component: "h2", gutterBottom: true }, "Profile"),
                    h(Stack, { spacing: 2 },
                        h(TextField, { label: "Name", value: name, onChange: (event) => setName(event.target.value), inputProps: { maxLength: 100 }, required: true }),
                        h(TextField, { label: "Profile description", value: bio, onChange: (event) => setBio(event.target.value), inputProps: { maxLength: 2000 }, multiline: true, minRows: 4 }),
                        h(FormControl, { fullWidth: true },
                            h(InputLabel, { id: "avatar-mode-label" }, "Profile avatar"),
                            h(Select, { labelId: "avatar-mode-label", label: "Profile avatar", value: avatarMode, onChange: (event) => setAvatarMode(event.target.value) },
                                h(MenuItem, { value: "initials" }, "Text / initials"),
                                h(MenuItem, { value: "default" }, "Default"),
                                h(MenuItem, { value: "identicon" }, "Identicon"),
                                h(MenuItem, { value: "gravatar" }, "Gravatar"),
                                h(MenuItem, { value: "custom" }, "Custom URL or uploaded image ID"),
                            ),
                        ),
                        h(TextField, { label: "Custom avatar value", value: avatarValue, onChange: (event) => setAvatarValue(event.target.value), inputProps: { maxLength: 2048 } }),
                        h(TextField, { label: "Website", type: "url", value: websiteUrl, onChange: (event) => setWebsiteUrl(event.target.value), inputProps: { maxLength: 2048 } }),
                        h(TextField, { label: "GitHub", type: "url", value: githubUrl, onChange: (event) => setGithubUrl(event.target.value), inputProps: { maxLength: 2048 } }),
                        h(Button, { type: "submit", variant: "contained", disabled: saving }, saving ? "Saving…" : "Save profile"),
                    ),
                ),
            ),
            h(
                Card,
                { variant: "outlined" },
                h(
                    CardContent,
                    null,
                    h(Typography, { variant: "h6", component: "h2", gutterBottom: true }, "Profile links"),
                    user.profileLinks?.length
                        ? h(Stack, { spacing: 1, sx: { mb: 2 } }, ...user.profileLinks.map((link) =>
                              h(Stack, { key: link.id, direction: "row", spacing: 1, alignItems: "center" },
                                  h(Button, { component: "a", href: link.url, target: "_blank", rel: "noopener noreferrer nofollow" }, link.label),
                                  h(Button, { color: "error", size: "small", onClick: () => removeLink(link.id) }, "Remove"),
                              ),
                          ))
                        : h(Typography, { color: "text.secondary", paragraph: true }, "No extra links yet."),
                    h(Stack, { component: "form", onSubmit: addLink, spacing: 2 },
                        h(TextField, { label: "Label", value: linkLabel, onChange: (event) => setLinkLabel(event.target.value), inputProps: { maxLength: 100 }, required: true }),
                        h(TextField, { label: "URL", type: "url", value: linkUrl, onChange: (event) => setLinkUrl(event.target.value), inputProps: { maxLength: 2048 }, required: true }),
                        h(Button, { type: "submit", variant: "outlined", disabled: linkSaving }, linkSaving ? "Adding…" : "Add link"),
                    ),
                ),
            ),
            h(Stack, { direction: "row", spacing: 1 },
                h(Button, { variant: "outlined", component: "a", href: "/dashboard/" }, "Dashboard"),
                h(Button, { component: "a", href: "/account/logout/" }, "Log out"),
            ),
        ),
    );
}

const root = document.querySelector("#account-page");
if (root) mount(root, h(AccountPage));
