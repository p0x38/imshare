import { AppBar, Button, Stack, Toolbar, Typography } from "@mui/material";

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
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                    {links.map(([label, href]) => (
                        <Button key={href} component="a" href={href} color="inherit" size="small">
                            {label}
                        </Button>
                    ))}
                </Stack>
            </Toolbar>
        </AppBar>
    );
}
