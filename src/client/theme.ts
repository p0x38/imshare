import { createTheme } from "@mui/material/styles";

const motionEase = "cubic-bezier(0.22, 1, 0.36, 1)";
const fastMotion = 180;
const fieldMotion = 220;
const rippleDuration = 420;

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
            MuiButtonBase: {
                defaultProps: {
                    disableRipple: false,
                    disableTouchRipple: false,
                },
                styleOverrides: {
                    root: ({ theme }) => ({
                        position: "relative",
                        transition: theme.transitions.create(["transform", "background-color", "color"], {
                            duration: fastMotion,
                        }),
                        "&:active": {
                            transform: "scale(0.98)",
                        },
                        "& .MuiTouchRipple-root": {
                            overflow: "hidden",
                            borderRadius: "inherit",
                        },
                        "& .MuiTouchRipple-rippleVisible": {
                            animationDuration: `${rippleDuration}ms`,
                            animationTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
                        },
                        "& .MuiTouchRipple-child": {
                            opacity: 0.22,
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            "&:active": {
                                transform: "none",
                            },
                            "& .MuiTouchRipple-rippleVisible": {
                                animationDuration: "1ms",
                            },
                        },
                    }),
                },
            },
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
            MuiTextField: {
                defaultProps: {
                    variant: "outlined",
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["background-color", "border-color", "box-shadow"], {
                            duration: fieldMotion,
                        }),
                        "& .MuiOutlinedInput-notchedOutline": {
                            transition: theme.transitions.create(["border-color", "border-width", "box-shadow"], {
                                duration: fieldMotion,
                            }),
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                            transitionDuration: "160ms",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderWidth: 2,
                        },
                        "&.Mui-focused": {
                            boxShadow: `0 0 0 3px color-mix(in srgb, ${mode === "dark" ? "#90caf9" : "#1976d2"} 14%, transparent)`,
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            "& .MuiOutlinedInput-notchedOutline": {
                                transition: "none",
                            },
                        },
                    }),
                    input: ({ theme }) => ({
                        transition: theme.transitions.create(["color", "opacity"], {
                            duration: fieldMotion,
                        }),
                    }),
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["color", "transform", "font-size"], {
                            duration: fieldMotion,
                        }),
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                        },
                    }),
                },
            },
            MuiFormHelperText: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["color", "opacity", "transform"], {
                            duration: fieldMotion,
                        }),
                        transformOrigin: "top left",
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
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
            MuiListItemButton: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["transform", "background-color", "color"], {
                            duration: fastMotion,
                        }),
                        "&:active": {
                            transform: "scale(0.99)",
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            "&:active": {
                                transform: "none",
                            },
                        },
                    }),
                },
            },
        },
    });
}
