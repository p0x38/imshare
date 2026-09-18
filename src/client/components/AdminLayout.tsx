import {
    Box,
    Card,
    CardContent,
    Divider,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import Dashboard from "@mui/icons-material/Dashboard";
import Group from "@mui/icons-material/Group";
import Article from "@mui/icons-material/Article";
import ReportProblem from "@mui/icons-material/ReportProblem";
import Settings from "@mui/icons-material/Settings";
import History from "@mui/icons-material/History";
import Insights from "@mui/icons-material/Insights";
import { PropsWithChildren, type ReactNode } from "react";
import { Page } from "./Page";

interface AdminNavItem {
    label: string;
    href: string;
    icon?: ReactNode;
}

interface AdminNavSection {
    label: string;
    items: AdminNavItem[];
}

const sections: AdminNavSection[] = [
    {
        label: "Overview",
        items: [{ label: "Home", href: "/admin/", icon: <Dashboard /> }],
    },
    {
        label: "Moderation",
        items: [
            { label: "Users", href: "/admin/users/", icon: <Group /> },
            { label: "Posts", href: "/admin/posts/", icon: <Article /> },
            { label: "Reports", href: "/admin/reports/", icon: <ReportProblem /> },
            { label: "Moderation log", href: "/admin/logs/", icon: <History /> },
        ],
    },
    {
        label: "Instance",
        items: [
            { label: "Analytics", href: "/admin/analytics/", icon: <Insights /> },
            { label: "Settings", href: "/admin/settings/", icon: <Settings /> },
        ],
    },
];

export function AdminLayout({
    title,
    description,
    activeHref,
    children,
}: PropsWithChildren<{
    title: string;
    description?: string;
    activeHref: string;
}>) {
    return (
        <Page maxWidth="xl">
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "250px minmax(0, 1fr)" },
                    gap: { xs: 2, lg: 3 },
                    alignItems: "start",
                }}
            >
                <Card
                    variant="outlined"
                    sx={{ position: { xs: "static", lg: "sticky" }, top: { lg: 88 } }}
                >
                    <CardContent sx={{ p: 1 }}>
                        <Stack spacing={1}>
                            {sections.map((section, index) => (
                                <Box key={section.label}>
                                    {index > 0 ? <Divider sx={{ my: 1 }} /> : null}
                                    <Typography
                                        variant="overline"
                                        color="text.secondary"
                                        sx={{ px: 1.5 }}
                                    >
                                        {section.label}
                                    </Typography>
                                    <List disablePadding>
                                        {section.items.map((item) => (
                                            <ListItemButton
                                                key={item.href}
                                                component="a"
                                                href={item.href}
                                                selected={activeHref === item.href}
                                                sx={{ borderRadius: 1 }}
                                            >
                                                {item.icon ? (
                                                    <ListItemIcon sx={{ minWidth: 38 }}>
                                                        {item.icon}
                                                    </ListItemIcon>
                                                ) : null}
                                                <ListItemText primary={item.label} />
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </Box>
                            ))}
                        </Stack>
                    </CardContent>
                </Card>

                <Stack spacing={3} sx={{ minWidth: 0 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="h4" component="h1">
                            {title}
                        </Typography>
                        {description ? (
                            <Typography color="text.secondary">{description}</Typography>
                        ) : null}
                    </Stack>
                    {children}
                </Stack>
            </Box>
        </Page>
    );
}
