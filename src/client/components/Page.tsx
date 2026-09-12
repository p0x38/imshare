import { Box, Container } from "@mui/material";
import { Navigation } from "./Navigation";

export function Page({ children, maxWidth = "xl" }: { children: React.ReactNode; maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" }) {
    return (
        <Box sx={{ minHeight: "100vh" }}>
            <Navigation />
            <Container maxWidth={maxWidth} sx={{ py: 3 }}>
                {children}
            </Container>
        </Box>
    );
}
