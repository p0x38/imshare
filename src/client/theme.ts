import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
    palette: {
        mode: "light",
    },
    shape: {
        borderRadius: 3,
    },
    typography: {
        fontFamily: "Roboto, system-ui, sans-serif",
    },
    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
        },
    },
});
