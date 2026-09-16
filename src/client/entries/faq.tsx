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

function CommunityFaqSection() {
    const items = [
        {
            question: "Where can I find the source code?",
            answer:
                "The source code is maintained in the p0x38/imshare GitHub repository.",
        },
        {
            question: "How can I contribute to imshare?",
            answer:
                "Fork the repository, make a focused change, run the relevant checks, and open a pull request. Larger changes should be discussed in an issue first. See CONTRIBUTING.md for the development workflow and pull request expectations.",
        },
        {
            question: "Can I use AI tools when contributing?",
            answer:
                "Yes. AI-assisted development can be used when working on imshare. Contributors are still responsible for reviewing the generated code, understanding the changes, checking for security and privacy problems, and testing the result before submitting it.",
        },
        {
            question: "Does imshare require an AI service to run?",
            answer:
                "No. The normal imshare runtime does not require an external AI service. AI tools can be used during development, research, debugging, or documentation work without making AI a runtime dependency.",
        },
        {
            question: "What should I check before submitting AI-assisted changes?",
            answer:
                "Treat AI-generated code like any other draft: verify it against the existing architecture, review authentication and authorization boundaries, avoid exposing secrets or private data, and run type checking, linting, tests, integration tests, and the production build when applicable.",
        },
    ];

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={1.5}>
                    <Typography variant="h5" component="h2">
                        GitHub and contributing
                    </Typography>
                    <List disablePadding>
                        {items.map((item, index) => (
                            <Stack key={item.question}>
                                <ListItem disableGutters alignItems="flex-start">
                                    <ListItemText
                                        primary={item.question}
                                        secondary={item.answer}
                                        primaryTypographyProps={{
                                            fontWeight: 600,
                                            gutterBottom: true,
                                        }}
                                    />
                                </ListItem>
                                {index < items.length - 1 ? <Divider component="li" /> : null}
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
                <CommunityFaqSection />
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
