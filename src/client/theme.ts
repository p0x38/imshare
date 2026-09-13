import { createTheme } from "@mui/material/styles";

export function createAppTheme(mode: "light" | "dark") {
    return createTheme({
        palette: {
            mode,
        },
        shape: {
            borderRadius: 3,
        },
        typography: {
            fontFamily: "Roboto, system-ui, sans-serif",
        },
        components: {
            MuiButtonBase: {
                defaultProps: {
                    disableRipple: true,
                    disableTouchRipple: true,
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
            },
            MuiTextField: {
                defaultProps: {
                    variant: "outlined",
                },
            },
        },
    });
}
