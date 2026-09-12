import { Box, Container } from "@mui/material";
import { Navigation } from "./Navigation";
import { PageTransition } from "./Motion";

export function Page({ children, maxWidth = "xl" }: { children: React.ReactNode; maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" }) {
    const width = maxWidth === "xs" ? 444 : maxWidth === "sm" ? 600 : maxWidth === "md" ? 900 : maxWidth === "lg" ? 1200 : 1200;

    return (
        <Box sx={{ minHeight: "100vh" }}>
            <Navigation />
            <PageTransition>
                <Container
                    component="div"
                    maxWidth={false}
                    sx={{
                        width: "100%",
                        maxWidth: width,
                        mx: "auto",
                        px: 0,
                        py: 0,
                    }}
                >
                    {children}
                </Container>
            </PageTransition>
        </Box>
    );
}
