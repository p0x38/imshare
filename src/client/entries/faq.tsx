import {
    Card,
    CardContent,
    Divider,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "../components/App";
import { Page } from "../components/Page";

const sections = [
    ["about", 3],
    ["accounts", 5],
    ["posts", 5],
    ["privacy", 4],
    ["discovery", 4],
    ["analytics", 3],
    ["troubleshooting", 4],
] as const;

type SectionKey = (typeof sections)[number][0];

function FaqSection({ section, count }: { section: SectionKey; count: number }) {
    const { t } = useTranslation();

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={1.5}>
                    <Typography variant="h5" component="h2">
                        {t(`faq.sections.${section}.title`)}
                    </Typography>
                    <List disablePadding>
                        {Array.from({ length: count }, (_, index) => (
                            <Stack key={index}>
                                <ListItem disableGutters alignItems="flex-start">
                                    <ListItemText
                                        primary={t(
                                            `faq.sections.${section}.items.${index}.question`,
                                        )}
                                        secondary={t(
                                            `faq.sections.${section}.items.${index}.answer`,
                                        )}
                                        primaryTypographyProps={{
                                            fontWeight: 600,
                                            gutterBottom: true,
                                        }}
                                    />
                                </ListItem>
                                {index < count - 1 ? <Divider component="li" /> : null}
                            </Stack>
                        ))}
                    </List>
                </Stack>
            </CardContent>
        </Card>
    );
}

function FaqPage() {
    const { t } = useTranslation();

    return (
        <Page maxWidth="md">
            <Stack spacing={2}>
                <Stack spacing={0.5}>
                    <Typography variant="h4" component="h1">
                        {t("faq.title")}
                    </Typography>
                    <Typography color="text.secondary">{t("faq.description")}</Typography>
                </Stack>
                {sections.map(([section, count]) => (
                    <FaqSection key={section} section={section} count={count} />
                ))}
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#faq-page");
if (root)
    createRoot(root).render(
        <App>
            <FaqPage />
        </App>,
    );
