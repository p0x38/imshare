import { CssBaseline, ThemeProvider } from "@mui/material";
import { theme } from "../theme";

export function App({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
