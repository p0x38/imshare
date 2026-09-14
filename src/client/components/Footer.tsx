import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface VersionResponse {
    data?: {
        version?: string;
    };
}

export function Footer() {
    const [version, setVersion] = useState<string>("");

    useEffect(() => {
        let active = true;

        void api<VersionResponse>("/v1/version")
            .then((response) => {
                if (active) setVersion(response.data?.version ?? "");
            })
            .catch(() => {
                // Version information is optional footer metadata.
            });

        return () => {
            active = false;
        };
    }, []);

    return (
        <Box
            component="footer"
            sx={{
                mt: "auto",
                borderTop: 1,
                borderColor: "divider",
                py: 2,
            }}
        >
            <Container
                maxWidth={false}
                sx={{
                    width: "100%",
                    maxWidth: 1200,
                    mx: "auto",
                    px: { xs: 1.5, sm: 2, md: 3 },
                }}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                    alignItems="center"
                    justifyContent="center"
                >
                    <Link href="/about/" underline="hover">About</Link>
                    <Typography color="text.secondary">·</Typography>
                    <Link href="/faq/" underline="hover">FAQ</Link>
                    <Typography color="text.secondary">·</Typography>
                    <Link href="/github/" underline="hover">GitHub</Link>
                    <Typography color="text.secondary">·</Typography>
                    <Link href="/privacy/" underline="hover">Privacy</Link>
                    <Typography color="text.secondary">·</Typography>
                    <Link href="/terms/" underline="hover">Terms</Link>
                    <Typography aria-label="Version" variant="body2" color="text.secondary">
                        {version ? `Version ${version}` : "Version"}
                    </Typography>
                </Stack>
            </Container>
        </Box>
    );
}
