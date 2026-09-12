import { Alert, Card, CardContent, CircularProgress, Skeleton, Stack, Typography } from "@mui/material";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
    return (
        <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
            <CircularProgress />
            <Typography color="text.secondary">{label}</Typography>
        </Stack>
    );
}

export function ErrorState({ message }: { message: string }) {
    return <Alert severity="error">{message}</Alert>;
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {Array.from({ length: count }, (_, index) => (
                <Card key={index} variant="outlined">
                    <Skeleton variant="rectangular" sx={{ aspectRatio: "1 / 1" }} />
                    <CardContent>
                        <Skeleton variant="text" width="70%" />
                        <Skeleton variant="text" width="45%" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
