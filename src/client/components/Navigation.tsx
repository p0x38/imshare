import { AccountCircle, Close, DarkMode, LightMode, Menu, NotificationsOutlined } from "@mui/icons-material";
import { AppBar, Avatar, Badge, Button, Drawer, IconButton, List, ListItemButton, ListItemText, Menu as MuiMenu, MenuItem, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useColorMode } from "./App";
import { api } from "../lib/api";
import type { User } from "../lib/types";

const links = [["posts", "/posts/"], ["texts", "/texts/"], ["users", "/users/"], ["tags", "/tags/"], ["categories", "/categories/"], ["search", "/search/"]] as const;

export function Navigation() {
    const { t } = useTranslation();
    const { mode, toggle } = useColorMode();
    const [user, setUser] = useState<User | null>(null);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [accountMenuAnchor, setAccountMenuAnchor] = useState<HTMLElement | null>(null);

    useEffect(() => {
        let active = true;
        void Promise.allSettled([
            api<{ data: User }>("/v1/me"),
            api<{ data: { count: number } }>("/v1/me/notifications/unread-count"),
        ]).then(([userResult, notificationResult]) => {
            if (!active) return;
            if (userResult.status === "fulfilled") setUser(userResult.value.data);
            if (notificationResult.status === "fulfilled") setUnreadNotifications(notificationResult.value.data.count);
        });
        return () => {
            active = false;
        };
    }, []);

    const displayName = user?.name || user?.username || t("common.account");
    const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "A";
    const modeLabel = mode === "dark" ? t("nav.useLightMode") : t("nav.useDarkMode");
    const canAccessAdmin = user?.role === "admin";
    const label = (key: string) => key === "texts" ? "Texts" : t(`nav.${key}`);
    const accountMenuOpen = Boolean(accountMenuAnchor);

    const closeAccountMenu = () => setAccountMenuAnchor(null);
    const goTo = (href: string) => {
        closeAccountMenu();
        location.href = href;
    };

    return <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 0.5, width: "100%", maxWidth: "none", mx: 0, px: { xs: 1.5, sm: 2, md: 3 }, py: { xs: 0.5, sm: 0 }, minHeight: { xs: 56, sm: 64 }, paddingTop: { xs: "calc(4px + env(safe-area-inset-top))", sm: 0 } }}>
            <IconButton color="inherit" edge="start" aria-label={t("nav.openNavigation")} onClick={() => setDrawerOpen(true)} sx={{ display: { xs: "inline-flex", sm: "none" } }}><Menu /></IconButton>
            <Typography component="a" href="/" variant="h6" sx={{ mr: { xs: 0, sm: 1 }, color: "inherit", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>imshare</Typography>
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ display: { xs: "none", sm: "flex" }, flexWrap: "wrap", flexGrow: 1 }}>
                {links.map(([key, href]) => <Button key={href} component="a" href={href} color="inherit" size="small" sx={{ minHeight: 40, px: 1.25 }}>{label(key)}</Button>)}
                {canAccessAdmin ? <Button component="a" href="/admin/" color="inherit" size="small" sx={{ minHeight: 40, px: 1.25 }}>{t("admin.administration")}</Button> : null}
            </Stack>
            <Stack direction="row" spacing={0.25} alignItems="center" sx={{ ml: "auto" }}>
                <Tooltip title={modeLabel}><IconButton color="inherit" aria-label={modeLabel} onClick={toggle}>{mode === "dark" ? <LightMode /> : <DarkMode />}</IconButton></Tooltip>
                <Tooltip title={unreadNotifications > 0 ? t("nav.unreadNotifications", { count: unreadNotifications }) : t("nav.notifications")}><IconButton component="a" href="/notifications/" color="inherit" aria-label={t("nav.notifications")}><Badge badgeContent={unreadNotifications} color="secondary" max={99} showZero={false}><NotificationsOutlined /></Badge></IconButton></Tooltip>
                <Tooltip title={displayName}>
                    <IconButton
                        color="inherit"
                        aria-label={t("nav.account", { name: displayName })}
                        aria-controls={accountMenuOpen ? "account-menu" : undefined}
                        aria-haspopup="menu"
                        aria-expanded={accountMenuOpen ? "true" : undefined}
                        onClick={(event) => setAccountMenuAnchor(event.currentTarget)}
                    >
                        <Avatar alt={displayName} src={user?.avatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>{user ? initials : <AccountCircle />}</Avatar>
                    </IconButton>
                </Tooltip>
                <MuiMenu
                    id="account-menu"
                    anchorEl={accountMenuAnchor}
                    open={accountMenuOpen}
                    onClose={closeAccountMenu}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}
                >
                    <MenuItem disabled sx={{ opacity: "1 !important", fontWeight: 600 }}>{displayName}</MenuItem>
                    {user?.handle ? <MenuItem onClick={() => goTo(`/users/@${encodeURIComponent(user.handle!)}`)}>Profile</MenuItem> : null}
                    <MenuItem onClick={() => goTo("/account/")}>Account</MenuItem>
                    <MenuItem onClick={() => goTo("/notifications/")}>Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ""}</MenuItem>
                    {canAccessAdmin ? <MenuItem onClick={() => goTo("/admin/")}>{t("admin.administration")}</MenuItem> : null}
                </MuiMenu>
            </Stack>
        </Toolbar>
        <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} ModalProps={{ keepMounted: true }} PaperProps={{ sx: { width: { xs: "min(82vw, 320px)", sm: 320 }, pt: "env(safe-area-inset-top)" } }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.25}><Typography variant="h6" fontWeight={700}>imshare</Typography><IconButton aria-label={t("nav.closeNavigation")} onClick={() => setDrawerOpen(false)}><Close /></IconButton></Stack>
            <List sx={{ px: 1 }}>{links.map(([key, href]) => <ListItemButton key={href} component="a" href={href} onClick={() => setDrawerOpen(false)} sx={{ minHeight: 48, borderRadius: 1.5 }}><ListItemText primary={label(key)} /></ListItemButton>)}{canAccessAdmin ? <ListItemButton component="a" href="/admin/" onClick={() => setDrawerOpen(false)} sx={{ minHeight: 48, borderRadius: 1.5 }}><ListItemText primary={t("admin.administration")} /></ListItemButton> : null}</List>
        </Drawer>
    </AppBar>;
}
