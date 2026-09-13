import { createTheme } from "@mui/material/styles";

const motionEase = "cubic-bezier(0.22, 1, 0.36, 1)";
const fastMotion = 180;
const fieldMotion = 220;
const validationMotion = 260;
const rippleDuration = 420;

export function createAppTheme(mode: "light" | "dark") {
    const errorColor = mode === "dark" ? "#f28b82" : "#d32f2f";
    const successColor = mode === "dark" ? "#81c995" : "#2e7d32";
    const focusColor = mode === "dark" ? "#90caf9" : "#1976d2";

    return createTheme({
        palette: {
            mode,
            error: { main: errorColor },
            success: { main: successColor },
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
                    disableRipple: true,
                    disableTouchRipple: true,
                },
                styleOverrides: {
                    root: ({ theme }) => ({
                        position: "relative",
                        transition: theme.transitions.create(
                            ["transform", "background-color", "color"],
                            {
                                duration: fastMotion,
                            },
                        ),
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
                        transition: theme.transitions.create(
                            ["transform", "box-shadow", "background-color", "border-color"],
                            {
                                duration: fastMotion,
                            },
                        ),
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
                        transition: theme.transitions.create(
                            ["background-color", "border-color", "box-shadow"],
                            {
                                duration: fieldMotion,
                            },
                        ),
                        "& .MuiOutlinedInput-notchedOutline": {
                            transition: theme.transitions.create(
                                ["border-color", "border-width", "box-shadow"],
                                {
                                    duration: fieldMotion,
                                },
                            ),
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                            transitionDuration: "160ms",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderWidth: 2,
                        },
                        "&.Mui-focused": {
                            boxShadow: `0 0 0 3px color-mix(in srgb, ${focusColor} 14%, transparent)`,
                        },
                        "&.Mui-error": {
                            animation: `imshare-field-error ${validationMotion}ms ${motionEase}`,
                        },
                        "&.Mui-error .MuiOutlinedInput-notchedOutline": {
                            borderColor: errorColor,
                        },
                        "&.Mui-focused.Mui-error": {
                            boxShadow: `0 0 0 3px color-mix(in srgb, ${errorColor} 14%, transparent)`,
                        },
                        "&.Mui-focused.Mui-error .MuiOutlinedInput-notchedOutline": {
                            borderColor: errorColor,
                        },
                        "&.MuiInputBase-adornedEnd .MuiInputAdornment-root, &.MuiInputBase-adornedStart .MuiInputAdornment-root":
                            {
                                transition: theme.transitions.create(
                                    ["color", "opacity", "transform"],
                                    {
                                        duration: fieldMotion,
                                    },
                                ),
                            },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            animation: "none",
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
                        "&.Mui-error": {
                            transitionDuration: `${validationMotion}ms`,
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                        },
                    }),
                },
            },
            MuiFormHelperText: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(
                            ["color", "opacity", "transform", "margin"],
                            {
                                duration: validationMotion,
                            },
                        ),
                        transformOrigin: "top left",
                        "&.Mui-error": {
                            animation: `imshare-helper-error ${validationMotion}ms ${motionEase}`,
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            animation: "none",
                        },
                    }),
                },
            },
            MuiFormControl: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["margin-bottom"], {
                            duration: validationMotion,
                        }),
                    }),
                },
            },
            MuiFormControlLabel: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["color", "opacity", "transform"], {
                            duration: fieldMotion,
                        }),
                        "& .MuiFormControlLabel-label": {
                            transition: theme.transitions.create(["color", "opacity"], {
                                duration: fieldMotion,
                            }),
                        },
                    }),
                },
            },
            MuiCheckbox: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["color", "transform"], {
                            duration: fastMotion,
                        }),
                        "&.Mui-checked": {
                            transform: "scale(1.04)",
                        },
                        "&:active": {
                            transform: "scale(0.94)",
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            "&.Mui-checked, &:active": {
                                transform: "none",
                            },
                        },
                    }),
                },
            },
            MuiRadio: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(["color", "transform"], {
                            duration: fastMotion,
                        }),
                        "&.Mui-checked": {
                            transform: "scale(1.04)",
                        },
                        "&:active": {
                            transform: "scale(0.94)",
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transition: "none",
                            "&.Mui-checked, &:active": {
                                transform: "none",
                            },
                        },
                    }),
                },
            },
            MuiSwitch: {
                styleOverrides: {
                    switchBase: ({ theme }) => ({
                        transitionDuration: `${fastMotion}ms`,
                        transitionTimingFunction: motionEase,
                        "&.Mui-checked": {
                            transform: "translateX(16px)",
                        },
                        "@media (prefers-reduced-motion: reduce)": {
                            transitionDuration: "1ms",
                        },
                    }),
                    thumb: {
                        transition:
                            "box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), width 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                    },
                    track: ({ theme }) => ({
                        transition: theme.transitions.create(["background-color", "opacity"], {
                            duration: fastMotion,
                        }),
                    }),
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        animation: `imshare-alert-enter ${validationMotion}ms ${motionEase}`,
                        "@media (prefers-reduced-motion: reduce)": {
                            animation: "none",
                        },
                    },
                    icon: ({ theme }) => ({
                        transition: theme.transitions.create(["transform", "opacity"], {
                            duration: fieldMotion,
                        }),
                    }),
                    message: ({ theme }) => ({
                        transition: theme.transitions.create(["opacity", "transform"], {
                            duration: fieldMotion,
                        }),
                    }),
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(
                            ["transform", "box-shadow", "border-color"],
                            {
                                duration: 220,
                            },
                        ),
                    }),
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: ({ theme }) => ({
                        transition: theme.transitions.create(
                            ["transform", "background-color", "color"],
                            {
                                duration: fastMotion,
                            },
                        ),
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
                        transition: theme.transitions.create(
                            ["transform", "background-color", "color"],
                            {
                                duration: fastMotion,
                            },
                        ),
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
