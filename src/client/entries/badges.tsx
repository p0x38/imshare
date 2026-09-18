import { Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";
import { UserBadges } from "../components/UserBadges";

const badges = [
    ["admin", "automatic"],
    ["moderator", "automatic"],
    ["veteran", "automatic"],
    ["contributor", "manual"],
    ["verified", "manual"],
    ["early-adopter", "manual"],
    ["bug-hunter", "manual"],
    ["supporter", "manual"],
    ["founder", "manual"],
    ["developer", "manual"],
    ["community-helper", "manual"],
    ["curator", "manual"],
] as const;

function BadgeCard({ badge, kind }: { badge: string; kind: "automatic" | "manual" }) {
    const { t } = useTranslation();
    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={1.25}>
                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <UserBadges user={{ badges: [badge] }} size="medium" />
                        <Chip size="small" variant="outlined" label={t(`badges.kind.${kind}`)} />
                    </Stack>
                    <Typography variant="h6">{t(`badges.items.${badge}.name`)}</Typography>
                    <Typography color="text.secondary">
                        {t(`badges.items.${badge}.description`)}
                    </Typography>
                    <Divider />
                    <Typography variant="body2">
                        <strong>{t("badges.howToEarn")}:</strong>{" "}
                        {t(`badges.items.${badge}.howToEarn`)}
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );
}

function BadgesPage() {
    const { t } = useTranslation();
    return (
        <Page maxWidth="md" title={t("badges.title")}>
            <Stack spacing={2}>
                <Stack spacing={0.5}>
                    <Typography variant="h4" component="h1">
                        {t("badges.title")}
                    </Typography>
                    <Typography color="text.secondary">{t("badges.description")}</Typography>
                </Stack>
                <Stack spacing={1.5}>
                    {badges.map(([badge, kind]) => (
                        <BadgeCard key={badge} badge={badge} kind={kind} />
                    ))}
                </Stack>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#badges-page");
if (root)
    createRoot(root).render(
        <App>
            <BadgesPage />
        </App>,
    );
