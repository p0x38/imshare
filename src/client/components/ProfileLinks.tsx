import {
    GitHub,
    Instagram,
    Language,
    Link as LinkIcon,
    Twitter,
    YouTube,
} from "@mui/icons-material";
import { Box, Link, Stack, Typography } from "@mui/material";

interface ProfileLink {
    id: string;
    label: string;
    url: string;
}

interface ProfileLinksProps {
    websiteUrl?: string | null;
    githubUrl?: string | null;
    links?: ProfileLink[] | null;
}

interface SocialInfo {
    name: string;
    username?: string;
    icon: typeof Language;
}

function getSocialInfo(url: string): SocialInfo {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        const parts = parsed.pathname.split("/").filter(Boolean);

        if (host === "github.com") {
            return { name: "GitHub", username: parts[0], icon: GitHub };
        }
        if (host === "youtube.com" || host === "youtu.be") {
            return { name: "YouTube", username: parts[0]?.startsWith("@") ? parts[0] : undefined, icon: YouTube };
        }
        if (host === "instagram.com") {
            return { name: "Instagram", username: parts[0], icon: Instagram };
        }
        if (host === "twitter.com" || host === "x.com") {
            return { name: "X", username: parts[0], icon: Twitter };
        }
    } catch {
        // Fall through to the generic link representation for invalid URLs.
    }

    return { name: "Website", icon: Language };
}

function getLinkLabel(label: string, url: string, social: SocialInfo): string {
    if (social.username) return `${social.name} (${social.username.replace(/^@/, "")})`;
    if (label.trim()) return label.trim();
    return social.name;
}

export function ProfileLinks({ websiteUrl, githubUrl, links = [] }: ProfileLinksProps) {
    const entries: ProfileLink[] = [
        ...(githubUrl ? [{ id: "github", label: "GitHub", url: githubUrl }] : []),
        ...(websiteUrl ? [{ id: "website", label: "Website", url: websiteUrl }] : []),
        ...(links ?? []),
    ];

    const unique = entries.filter(
        (entry, index, all) => all.findIndex((candidate) => candidate.url === entry.url) === index,
    );

    if (!unique.length) return null;

    return (
        <Stack spacing={1.25} sx={{ mt: 2 }}>
            {unique.map((entry) => {
                const social = getSocialInfo(entry.url);
                const Icon = social.icon;
                const label = getLinkLabel(entry.label, entry.url, social);

                return (
                    <Stack
                        key={entry.id}
                        direction="row"
                        spacing={1.25}
                        alignItems="flex-start"
                        sx={{ minWidth: 0 }}
                    >
                        <Box sx={{ pt: 0.25, display: "flex" }}>
                            <Icon fontSize="small" />
                        </Box>
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                            <Link
                                href={entry.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{
                                    fontWeight: 600,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {label}
                            </Link>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ overflowWrap: "anywhere" }}
                            >
                                → {entry.url}
                            </Typography>
                        </Stack>
                    </Stack>
                );
            })}
        </Stack>
    );
}
