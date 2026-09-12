import { Alert, Button, Card, CardContent, FormControl, FormControlLabel, Radio, RadioGroup, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { App, useColorMode } from "../components/App";
import { Page } from "../components/Page";

function SettingsPage() {
    const { mode, toggle } = useColorMode();
    const [saved, setSaved] = useState(false);

    return (
        <Page>
            <Stack spacing={2}>
                <Typography variant="h4" component="h1">Settings</Typography>
                {saved ? <Alert severity="success" onClose={() => setSaved(false)}>Settings saved.</Alert> : null}
                <Card variant="outlined">
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="h6" component="h2">Appearance</Typography>
                            <FormControl>
                                <RadioGroup
                                    value={mode}
                                    onChange={(event) => {
                                        if (event.target.value !== mode) toggle();
                                        setSaved(true);
                                    }}
                                >
                                    <FormControlLabel value="light" control={<Radio />} label="Light" />
                                    <FormControlLabel value="dark" control={<Radio />} label="Dark" />
                                </RadioGroup>
                            </FormControl>
                        </Stack>
                    </CardContent>
                </Card>
                <Stack direction="row" spacing={1}>
                    <Button variant="outlined" component="a" href="/dashboard/">Dashboard</Button>
                    <Button component="a" href="/account/">Account profile</Button>
                </Stack>
            </Stack>
        </Page>
    );
}

const root = document.querySelector("#settings-page");
if (root) createRoot(root).render(<App><SettingsPage /></App>);
