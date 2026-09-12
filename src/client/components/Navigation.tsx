import { AccountCircle, DarkMode, LightMode, NotificationsOutlined } from "@mui/icons-material";
import { AppBar, Avatar, Badge, Button, IconButton, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
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
            <Toolbar sx={{ gap: 1, flexWrap: "wrap", width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 1.5, sm: 2, md: 3 } }}>
                <Typography component="a" href="/" variant="h6" sx={{ mr: 1, color: "inherit", textDecoration: "none", fontWeight: 700 }}>
                    imshare
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", flexGrow: 1 }}>
                    {links.map(([label, href]) => (
                        <Button key={href} component="a" href={href} color="inherit" size="small">
                            {label}
                        </Button>
                    ))}
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
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
        </AppBar>
    );
}
