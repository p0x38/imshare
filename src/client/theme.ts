import { createTheme } from "@mui/material/styles";

const motionEase = "cubic-bezier(0.22, 1, 0.36, 1)";

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
        transitions: {
            easing: {
                easeInOut: motionEase,
                easeOut: motionEase,
                easeIn: "cubic-bezier(0.4, 0, 1, 1)",
                sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
            },
        },
        components: {
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
            },
        },
    });
}
