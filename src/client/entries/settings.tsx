import {
    Alert,
    Button,
    Card,
    CardContent,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    Stack,
    Switch,
    Typography,
} from "@mui/material";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { App, useColorMode, useThemeSettings } from "../components/App";
import type { AccentColor } from "../theme";
import { Page } from "../components/Page";

function SettingsPage() {
    const { preference, setPreference } = useColorMode();
    const { settings, setAnimations, setRipple, setAccentColor } = useThemeSettings();
    const [saved, setSaved] = useState(false);

    const saveNotice = () => setSaved(true);

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
                                    value={preference}
                                    onChange={(event) => {
                                        setPreference(event.target.value as "light" | "dark" | "auto");
                                        saveNotice();
                                    }}
                                >
                                    <FormControlLabel value="light" control={<Radio />} label="Light" />
                                    <FormControlLabel value="dark" control={<Radio />} label="Dark" />
                                    <FormControlLabel value="auto" control={<Radio />} label="Automatic (Device)" />
                                </RadioGroup>
                            </FormControl>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.animations}
                                        onChange={(event) => {
                                            setAnimations(event.target.checked);
                                            saveNotice();
                                        }}
                                    />
                                }
                                label="Enable interface animations"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={settings.ripple}
                                        onChange={(event) => {
                                            setRipple(event.target.checked);
                                            saveNotice();
                                        }}
                                    />
                                }
                                label="Enable button ripple"
                            />
                            <FormControl>
                                <Typography variant="subtitle2" gutterBottom>Accent color</Typography>
                                <RadioGroup
                                    row
                                    value={settings.accentColor}
                                    onChange={(event) => {
                                        setAccentColor(event.target.value as AccentColor);
                                        saveNotice();
                                    }}
                                >
                                    <FormControlLabel value="default" control={<Radio />} label="Default" />
                                    <FormControlLabel value="blue" control={<Radio />} label="Blue" />
                                    <FormControlLabel value="purple" control={<Radio />} label="Purple" />
                                    <FormControlLabel value="green" control={<Radio />} label="Green" />
                                    <FormControlLabel value="orange" control={<Radio />} label="Orange" />
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
