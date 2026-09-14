import { Alert, Box, Card, CardContent, CircularProgress, Fade, Skeleton, Stack, Typography } from "@mui/material";
import { AnimatedItem } from "./Motion";

export function LoadingState({ label = "Loading…", fullHeight = false }: { label?: string; fullHeight?: boolean }) {
    return (
        <Fade in appear timeout={280}>
            <Stack
                alignItems="center"
                justifyContent="center"
                spacing={2}
                role="status"
                aria-live="polite"
                sx={{ py: fullHeight ? 10 : 6, minHeight: fullHeight ? "40vh" : undefined }}
            >
                <CircularProgress size={32} aria-label={label} />
                <Typography color="text.secondary">{label}</Typography>
            </Stack>
        </Fade>
    );
}

export function SkeletonState({
    lines = 3,
    showTitle = true,
}: {
    lines?: number;
    showTitle?: boolean;
}) {
    return (
        <Stack spacing={2} aria-busy="true" aria-label="Loading content">
            {showTitle ? <Skeleton variant="text" animation="wave" width="34%" sx={{ fontSize: "2.125rem" }} /> : null}
            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={1.25}>
                        {Array.from({ length: lines }, (_, index) => (
                            <Skeleton
                                key={index}
                                variant="text"
                                animation="wave"
                                width={index === lines - 1 ? "62%" : `${94 - Math.min(index, 4) * 7}%`}
                            />
                        ))}
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}

export function ErrorState({ message }: { message: string }) {
    return (
        <Fade in appear timeout={260}>
            <Alert severity="error">{message}</Alert>
        </Fade>
    );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
    return (
        <Box
            sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 2,
            }}
            aria-busy="true"
            aria-label="Loading posts"
        >
            {Array.from({ length: count }, (_, index) => (
                <AnimatedItem key={index} delay={Math.min(index, 8) * 45} duration={300}>
                    <Card variant="outlined" sx={{ overflow: "hidden" }}>
                        <Skeleton variant="rectangular" animation="wave" sx={{ aspectRatio: "1 / 1" }} />
                        <CardContent>
                            <Skeleton variant="text" animation="wave" width="70%" />
                            <Skeleton variant="text" animation="wave" width="45%" />
                        </CardContent>
                    </Card>
                </AnimatedItem>
            ))}
        </Box>
    );
}
