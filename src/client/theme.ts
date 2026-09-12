import { createTheme } from "@mui/material/styles";

const motionEase = "cubic-bezier(0.22, 1, 0.36, 1)";
const fastMotion = 180;

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
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["transform", "box-shadow", "background-color", "border-color"], {
                            duration: fastMotion,
                        }),
                        "&:hover": {
                            transform: "translateY(-1px)",
                        },
                        "&:active": {
                            transform: "translateY(0) scale(0.98)",
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            "&:hover, &:active": {
                                transform: "none",
                            },
                        },
                    }),
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["transform", "box-shadow", "border-color"], {
                            duration: 220,
                        }),
                    }),
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["transform", "background-color", "color"], {
                            duration: fastMotion,
                        }),
                        "&:hover": {
                            transform: "scale(1.06)",
                        },
                        "&:active": {
                            transform: "scale(0.94)",
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            "&:hover, &:active": {
                                transform: "none",
                            },
                        },
                    }),
                },
            },
        },
    });
}
