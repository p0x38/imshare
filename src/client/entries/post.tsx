import { Alert, Button, Container, Stack, ThemeProvider, Typography } from "@mui/material";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { api } from "../lib/api";
import { theme } from "../theme";

async function PostEntry() {
    const postId = decodeURIComponent(location.pathname.replace(/^\/posts\//, "").replace(/\/$/, ""));
    const root = document.querySelector("#post");
    if (!root) return;

    try {
        const response = await api<{ data: { title?: string } }>(`/v1/posts/${encodeURIComponent(postId)}`);
        document.title = `${response.data.title || "Untitled"} · imshare`;
        const legacy = await import("/posts/post-page.js");
        legacy.mountPostPage(root, postId);
    } catch (cause) {
        createRoot(root).render(
            <App>
                <ThemeProvider theme={theme}>
                    <Container maxWidth="sm" sx={{ py: 6 }}>
                        <Stack spacing={2}>
                            <Alert severity="error">{cause instanceof Error ? cause.message : "Unable to load post."}</Alert>
                            <Button component="a" href="/posts/">Back to posts</Button>
                        </Stack>
                    </Container>
                </ThemeProvider>
            </App>,
        );
    }
}

void PostEntry();
