import { Alert, Box, Button, Card, CardContent, CircularProgress, Link, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { Page } from "../components/Page";

interface GitCommit {
    sha: string;
    html_url: string;
    commit: {
        message: string;
        author: {
            name: string;
            date: string;
        } | null;
    };
}

const GITHUB_COMMITS_URL = "https://api.github.com/repos/p0x38/imshare/commits?per_page=30";

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function CommitCard({ commit }: { commit: GitCommit }) {
    const subject = commit.commit.message.split("\n", 1)[0] ?? commit.commit.message;
    const body = commit.commit.message.slice(subject.length).replace(/^\n+/, "").trim();
    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={1}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1}>
                        <Typography variant="subtitle1" component="h2" sx={{ overflowWrap: "anywhere", fontWeight: 600 }}>
                            {subject || "(no commit message)"}
                        </Typography>
                        <Link href={commit.html_url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontFamily: "monospace", flexShrink: 0 }}>
                            {commit.sha.slice(0, 7)}
                        </Link>
                    </Stack>
                    {body ? <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{body}</Typography> : null}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 2 }}>
                        <Typography variant="caption" color="text.secondary">{commit.commit.author?.name ?? "Unknown author"}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDate(commit.commit.author?.date ?? "")}</Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

function GitCommitsPage() {
    const [commits, setCommits] = useState<GitCommit[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        void fetch(GITHUB_COMMITS_URL, { headers: { Accept: "application/vnd.github+json" } })
            .then(async (response) => {
                if (!response.ok) throw new Error(`GitHub API returned ${response.status}.`);
                return response.json() as Promise<GitCommit[]>;
            })
            .then((data) => setCommits(data))
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load git commits."));
    }, []);

    return (
        <Page maxWidth="md">
            <Stack spacing={2}>
                <Box>
                    <Typography variant="h4" component="h1">Git commit log</Typography>
                    <Typography color="text.secondary">Recent changes to the imshare source repository.</Typography>
                </Box>
                {error ? (
                    <Stack spacing={1.5}>
                        <Alert severity="error">{error}</Alert>
                        <Button variant="outlined" href="https://github.com/p0x38/imshare/commits/" target="_blank" rel="noopener noreferrer">Open commit history on GitHub</Button>
                    </Stack>
                ) : commits === null ? (
                    <Stack alignItems="center" py={6}><CircularProgress /></Stack>
                ) : commits.length ? (
                    <Stack spacing={1.5}>{commits.map((commit) => <CommitCard key={commit.sha} commit={commit} />)}</Stack>
                ) : (
                    <Alert severity="info">No commits were returned by GitHub.</Alert>
                )}
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#git-commits-page");
if (root) createRoot(root).render(<App><GitCommitsPage /></App>);
