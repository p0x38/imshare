import {
    AccountCircle,
    Close,
    DarkMode,
    LightMode,
    Menu,
    NotificationsOutlined,
} from "@mui/icons-material";
import {
    AppBar,
    Avatar,
    Badge,
    Button,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useColorMode } from "./App";
import { api } from "../lib/api";
import type { User } from "../lib/types";

const links = [
    ["Posts", "/posts/"],
    ["Users", "/users/"],
    ["Tags", "/tags/"],
    ["Categories", "/categories/"],
    ["Search", "/search/"],
] as const;

export function Navigation() {
    const { mode, toggle } = useColorMode();
    const [user, setUser] = useState<User | null>(null);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [drawerOpen, setDrawerOpen] = useState(false);

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

    const displayName = user?.name || user?.username || "Account";
    const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("") || "A";

    return (
        <AppBar position="static" elevation={0}>
            <Toolbar
                sx={{
                    gap: 0.5,
                    width: "100%",
                    maxWidth: 1200,
                    mx: "auto",
                    px: { xs: 1, sm: 2, md: 3 },
                    py: { xs: 0.5, sm: 0 },
                    minHeight: { xs: 56, sm: 64 },
                }}
            >
                <IconButton
                    color="inherit"
                    edge="start"
                    aria-label="Open navigation"
                    onClick={() => setDrawerOpen(true)}
                    sx={{ display: { xs: "inline-flex", sm: "none" } }}
                >
                    <Menu />
                </IconButton>

                <Typography
                    component="a"
                    href="/"
                    variant="h6"
                    sx={{
                        mr: { xs: 0, sm: 1 },
                        color: "inherit",
                        textDecoration: "none",
                        fontWeight: 700,
                        flexShrink: 0,
                    }}
                >
                    imshare
                </Typography>

                <Stack
                    direction="row"
                    spacing={0.5}
                    useFlexGap
                    sx={{ display: { xs: "none", sm: "flex" }, flexWrap: "wrap", flexGrow: 1 }}
                >
                    {links.map(([label, href]) => (
                        <Button key={href} component="a" href={href} color="inherit" size="small">
                            {label}
                        </Button>
                    ))}
                </Stack>

                <Stack direction="row" spacing={0.25} alignItems="center" sx={{ ml: "auto" }}>
                    <Tooltip title={mode === "dark" ? "Use light mode" : "Use dark mode"}>
                        <IconButton color="inherit" aria-label={mode === "dark" ? "Use light mode" : "Use dark mode"} onClick={toggle}>
                            {mode === "dark" ? <LightMode /> : <DarkMode />}
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Notifications">
                        <IconButton component="a" href="/notifications/" color="inherit" aria-label="Notifications">
                            <Badge badgeContent={unreadNotifications} color="secondary" max={99}>
                                <NotificationsOutlined />
                            </Badge>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={displayName}>
                        <IconButton component="a" href="/account/" color="inherit" aria-label={`Account: ${displayName}`}>
                            <Avatar alt={displayName} src={user?.avatarUrl ?? undefined} sx={{ width: 32, height: 32 }}>
                                {user ? initials : <AccountCircle />}
                            </Avatar>
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Toolbar>

            <Drawer
                anchor="left"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: {
                        width: { xs: "min(82vw, 320px)", sm: 320 },
                        pt: "env(safe-area-inset-top)",
                    },
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.25}>
                    <Typography variant="h6" fontWeight={700}>
                        imshare
                    </Typography>
                    <IconButton aria-label="Close navigation" onClick={() => setDrawerOpen(false)}>
                        <Close />
                    </IconButton>
                </Stack>
                <List sx={{ px: 1 }}>
                    {links.map(([label, href]) => (
                        <ListItemButton
                            key={href}
                            component="a"
                            href={href}
                            onClick={() => setDrawerOpen(false)}
                            sx={{ minHeight: 48, borderRadius: 1.5 }}
                        >
                            <ListItemText primary={label} />
                        </ListItemButton>
                    ))}
                </List>
            </Drawer>
        </AppBar>
    );
}
