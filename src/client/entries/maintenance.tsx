import { BuildOutlined, Construction, HomeOutlined } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";

function MaintenancePage() {
    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                px: 2,
                py: 4,
                boxSizing: "border-box",
            }}
        >
            <Card variant="outlined" sx={{ width: "100%", maxWidth: 560 }}>
                <CardContent>
                    <Stack spacing={3} alignItems="center" textAlign="center">
                        <Box
                            sx={{
                                width: 72,
                                height: 72,
                                borderRadius: "50%",
                                display: "grid",
                                placeItems: "center",
                                bgcolor: "action.hover",
                            }}
                        >
                            <Construction fontSize="large" />
                        </Box>

                        <Stack spacing={1} alignItems="center">
                            <Chip
                                icon={<BuildOutlined />}
                                label="Development / Test Environment"
                                size="small"
                            />
                            <Typography variant="h4" component="h1">
                                Under maintenance
                            </Typography>
                            <Typography color="text.secondary">
                                imshare is currently running in a local or test environment.
                            </Typography>
                            <Typography color="text.secondary">
                                The normal web interface is intentionally unavailable here.
                            </Typography>
                        </Stack>

                        <Button
                            variant="outlined"
                            startIcon={<HomeOutlined />}
                            onClick={() => window.location.reload()}
                        >
                            Reload
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}

const root = document.querySelector("#maintenance-page");

if (root) {
    createRoot(root).render(
        <App>
            <MaintenancePage />
        </App>,
    );
}
