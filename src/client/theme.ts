import { createTheme } from "@mui/material/styles";

export type AccentColor = "default" | "blue" | "purple" | "green" | "orange";

export interface ThemeSettings {
    animations: boolean;
    ripple: boolean;
    accentColor: AccentColor;
}

const accents: Record<AccentColor, { light: string; dark: string }> = {
    default: { light: "#1976d2", dark: "#90caf9" },
    blue: { light: "#1976d2", dark: "#90caf9" },
    purple: { light: "#7b1fa2", dark: "#ce93d8" },
    green: { light: "#2e7d32", dark: "#81c784" },
    orange: { light: "#ed6c02", dark: "#ffb74d" },
};

const motionEase = "cubic-bezier(0.22, 1, 0.36, 1)";

export function createAppTheme(mode: "light" | "dark", settings: ThemeSettings) {
    const accent = accents[settings.accentColor];
    const animations = settings.animations;

    return createTheme({
        palette: {
            mode,
            primary: {
                main: accent[mode],
            },
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
            ...(animations
                ? {}
                : {
                      duration: {
                          shortest: 0,
                          shorter: 0,
                          short: 0,
                          standard: 0,
                          complex: 0,
                          enteringScreen: 0,
                          leavingScreen: 0,
                      },
                  }),
        },
        components: {
            MuiButtonBase: {
                defaultProps: {
                    disableRipple: !settings.ripple,
                    disableTouchRipple: !settings.ripple,
                },
                ...(animations
                    ? {
                          styleOverrides: {
                              root: {
                                  transition: `transform 180ms ${motionEase}, background-color 180ms ${motionEase}, color 180ms ${motionEase}`,
                              },
                          },
                      }
                    : {}),
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
                ...(animations
                    ? {
                          styleOverrides: {
                              root: {
                                  transition: `transform 180ms ${motionEase}, background-color 180ms ${motionEase}, border-color 180ms ${motionEase}`,
                                  "&:hover": {
                                      transform: "translateY(-1px)",
                                  },
                                  "&:active": {
                                      transform: "translateY(0) scale(0.98)",
                                  },
                              },
                          },
                      }
                    : {}),
            },
            MuiCard: animations
                ? {
                      styleOverrides: {
                          root: {
                              transition: `transform 220ms ${motionEase}, box-shadow 220ms ${motionEase}, border-color 220ms ${motionEase}`,
                          },
                      },
                  }
                : {},
            MuiIconButton: animations
                ? {
                      styleOverrides: {
                          root: {
                              transition: `transform 180ms ${motionEase}, background-color 180ms ${motionEase}, color 180ms ${motionEase}`,
                              "&:hover": {
                                  transform: "scale(1.06)",
                              },
                              "&:active": {
                                  transform: "scale(0.94)",
                              },
                          },
                      },
                  }
                : {},
            MuiTextField: {
                defaultProps: {
                    variant: "outlined",
                },
            },
        },
    });
}
