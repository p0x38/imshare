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
import { App } from "../components/App";
import { Page } from "../components/Page";

const sections = [
    {
        title: "About imshare",
        items: [
            ["What is imshare?", "imshare is a self-hosted image archive and sharing server. It lets the server operator control storage, accounts, moderation, and the public site."],
            ["Who operates this server?", "The server operator controls the instance, including its storage, moderation policy, registration policy, and privacy practices. Check the Privacy and Terms pages for instance-specific information."],
            ["Is imshare the same as a public image host?", "No. Each imshare instance is independently operated. Features and policies can differ between instances."],
        ],
    },
    {
        title: "Accounts and registration",
        items: [
            ["How do I create an account?", "Open the registration page and provide your name, email address, password, and the current registration access token when the instance requires one."],
            ["Why is a registration token required?", "This instance can restrict new account creation using a rotating registration token. The server operator controls that token."],
            ["Can I use a custom username handle?", "Yes. A handle uses the /users/@handle URL form while your internal user ID remains unchanged. Handles are normalized to lowercase and must be unique."],
            ["What happens when a handle is already taken?", "The server rejects the change and reports that the handle is already taken. Choosing another available handle does not change your user ID."],
            ["Can I change my profile later?", "Yes. Account and profile settings can be updated from the account pages, subject to the permissions and fields provided by the server."],
        ],
    },
    {
        title: "Posts and uploads",
        items: [
            ["How do uploads become posts?", "New uploads are created as draft posts. You can then edit their metadata and publish them when they are ready."],
            ["What happens when I upload multiple images?", "By default, each selected image becomes its own draft post. You can enable the multi-image option to put all selected images into one post."],
            ["What are the visibility options?", "Public posts can be shown publicly, unlisted posts are intended for sharing without normal listing, and private posts are restricted according to the instance's access rules."],
            ["Can I delete a post?", "Yes. The post editor provides a delete action for posts you are allowed to manage."],
            ["Can I download original files?", "Downloads depend on the post's allow-download setting and the permissions enforced by the server."],
        ],
    },
    {
        title: "Privacy and moderation",
        items: [
            ["Who can see my profile?", "Profile visibility depends on your account privacy settings and the instance's configuration. Public profiles can appear in public profile pages and search results."],
            ["Who can see my posts?", "Post visibility and your profile's post visibility settings both affect whether a post is publicly accessible."],
            ["What can moderators do?", "Moderators can review reports and perform supported moderation actions. Administrators have additional instance-management permissions."],
            ["What happens when content is reported?", "Reports can be reviewed by moderators. A report may be left open, resolved, or dismissed depending on the moderation decision."],
        ],
    },
    {
        title: "Search, discovery, and indexing",
        items: [
            ["Why can a public post still be missing from search engines?", "Being publicly reachable does not guarantee indexing. Search engines decide which pages to crawl and index based on accessibility, site signals, content quality, and their own policies."],
            ["What is sitemap.xml?", "The sitemap lists public URLs that the instance wants search engines to discover. It does not force a search engine to index every URL."],
            ["What does robots.txt do?", "robots.txt communicates crawler rules for the site and points crawlers to the sitemap."],
            ["Why are dashboard and account pages excluded?", "Those areas are intended for authenticated management and personal use rather than public search discovery."],
        ],
    },
    {
        title: "Analytics and cookies",
        items: [
            ["Does this site use Google Analytics or Google Tag Manager?", "The server operator can configure Google Analytics 4 and Google Tag Manager from the administrator dashboard. They can also leave both disabled."],
            ["Where are analytics settings changed?", "Administrators can manage the configured measurement and container IDs from the Admin dashboard. The values are stored in the server configuration."],
            ["Does changing an analytics ID require changing the frontend code?", "No. The site reads the configured values from the server configuration and injects the enabled integration into rendered pages."],
        ],
    },
    {
        title: "Troubleshooting",
        items: [
            ["Registration says the origin is invalid. Why?", "The browser origin must be included in the server's Better Auth trusted origins. The instance configuration supports this through auth.trustedOrigins."],
            ["The site shows an old version after deployment. What should I check?", "Rebuild the application, restart the server, and make sure the deployed dist directory matches the source branch you intended to deploy."],
            ["An API request returns 401 or 403. What does that usually mean?", "401 normally indicates that authentication is required or the session is missing. 403 can indicate insufficient permissions or a rejected request origin."],
            ["Where can I find the API documentation?", "The instance exposes its OpenAPI documentation at /docs when API documentation is enabled."],
        ],
    },
];

function FaqSection({ title, items }: { title: string; items: readonly (readonly [string, string])[] }) {
    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={1.5}>
                    <Typography variant="h5" component="h2">{title}</Typography>
                    <List disablePadding>
                        {items.map(([question, answer], index) => (
                            <Stack key={question}>
                                <ListItem disableGutters alignItems="flex-start">
                                    <ListItemText
                                        primary={question}
                                        secondary={answer}
                                        primaryTypographyProps={{ fontWeight: 600, gutterBottom: true }}
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
    return (
        <Page maxWidth="md">
            <Stack spacing={2}>
                <Stack spacing={0.5}>
                    <Typography variant="h4" component="h1">Frequently Asked Questions</Typography>
                    <Typography color="text.secondary">
                        Common questions about accounts, posts, privacy, discovery, administration, and troubleshooting.
                    </Typography>
                </Stack>
                {sections.map((section) => <FaqSection key={section.title} {...section} />)}
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#faq-page");
if (root) createRoot(root).render(<App><FaqPage /></App>);
