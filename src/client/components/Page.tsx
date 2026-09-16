import { Box, Container } from "@mui/material";
import { useEffect } from "react";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";
import { PageTransition } from "./Motion";
import { OidcLoginButton } from "./OidcLoginButton";

export function Page({
    children,
    maxWidth = "xl",
    title,
}: {
    children: React.ReactNode;
    maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
    title?: string;
}) {
    const width =
        maxWidth === "xs"
            ? 444
            : maxWidth === "sm"
              ? 600
              : maxWidth === "md"
                ? 900
                : maxWidth === "lg"
                  ? 1200
                  : 1200;

    useEffect(() => {
        if (title) document.title = title;
    }, [title]);

    const isAccountAuthPage =
        location.pathname === "/account/login" || location.pathname === "/account/register" ||
        location.pathname === "/account/login/" || location.pathname === "/account/register/";

    return (
        <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Navigation />
            <PageTransition>
                <Container
                    component="main"
                    maxWidth={false}
                    sx={{
                        width: "100%",
                        maxWidth: width,
                        mx: "auto",
                        px: { xs: 1.5, sm: 2, md: 3 },
                        py: { xs: 2, sm: 3 },
                        flex: 1,
                    }}
                >
                    {children}
                    {isAccountAuthPage ? <OidcLoginButton /> : null}
                </Container>
            </PageTransition>
            <Footer />
        </Box>
    );
}
