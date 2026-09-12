import { DarkMode, LightMode } from "@mui/icons-material";
import { AppBar, Button, IconButton, Stack, Toolbar, Tooltip, Typography } from "@mui/material";
import { useColorMode } from "./App";

const links = [
    ["Posts", "/posts/"],
    ["Users", "/users/"],
    ["Tags", "/tags/"],
    ["Categories", "/categories/"],
    ["Search", "/search/"],
    ["Notifications", "/notifications/"],
    ["Account", "/account/"],
] as const;

export function Navigation() {
    const { mode, toggle } = useColorMode();

    return (
        <AppBar position="static" elevation={0}>
            <Toolbar sx={{ gap: 1, flexWrap: "wrap", maxWidth: 1200, width: "100%", mx: "auto" }}>
                <Typography
                    component="a"
                    href="/"
                    variant="h6"
                    sx={{ mr: 1, color: "inherit", textDecoration: "none", fontWeight: 700 }}
                >
                    imshare
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", flexGrow: 1 }}>
                    {links.map(([label, href]) => (
                        <Button key={href} component="a" href={href} color="inherit" size="small">
                            {label}
                        </Button>
                    ))}
                </Stack>
                <Tooltip title={mode === "dark" ? "Use light mode" : "Use dark mode"}>
                    <IconButton color="inherit" aria-label={mode === "dark" ? "Use light mode" : "Use dark mode"} onClick={toggle}>
                        {mode === "dark" ? <LightMode /> : <DarkMode />}
                    </IconButton>
                </Tooltip>
            </Toolbar>
        </AppBar>
    );
}
