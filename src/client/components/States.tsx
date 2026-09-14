import { Alert, Box, Card, CardContent, CircularProgress, Fade, Skeleton, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AnimatedItem } from "./Motion";

export function LoadingState({ label, fullHeight = false }: { label?: string; fullHeight?: boolean }) {
    const { t } = useTranslation();
    const text = label ?? t("common.loading");
    return <Fade in appear timeout={280}><Stack alignItems="center" justifyContent="center" spacing={2} role="status" aria-live="polite" sx={{ py: fullHeight ? 10 : 6, minHeight: fullHeight ? "40vh" : undefined }}><CircularProgress size={32} aria-label={text} /><Typography color="text.secondary">{text}</Typography></Stack></Fade>;
}
export function ErrorState({ message }: { message: string }) { return <Fade in appear timeout={260}><Alert severity="error">{message}</Alert></Fade>; }
export function SkeletonGrid({ count = 8 }: { count?: number }) { const { t } = useTranslation(); return <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(220px, 1fr))" gap={2} aria-busy="true" aria-label={t("states.loadingPosts")}>{Array.from({ length: count }, (_, index) => <AnimatedItem key={index} delay={Math.min(index, 8) * 45} duration={300}><Card variant="outlined" sx={{ overflow: "hidden" }}><Skeleton variant="rectangular" animation="wave" sx={{ aspectRatio: "1 / 1" }} /><CardContent><Skeleton variant="text" animation="wave" width="70%" /><Skeleton variant="text" animation="wave" width="45%" /></CardContent></Card></AnimatedItem>)}</Box>; }
