import { Box } from "@mui/material";

import type { AvatarDecorationProps } from "./types";

export function GooglyEyes({ size }: AvatarDecorationProps) {
    const eyeSize = Math.max(6, size * 0.19);

    return (
        <Box
            aria-hidden="true"
            sx={{
                position: "absolute",
                top: "25%",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: `${Math.max(2, size * 0.035)}px`,
                pointerEvents: "none",
                zIndex: 2,
            }}
        >
            {[0, 1].map((index) => (
                <Box
                    key={index}
                    sx={{
                        position: "relative",
                        width: eyeSize,
                        height: eyeSize,
                        borderRadius: "50%",
                        bgcolor: "#fff",
                        border: "1px solid #222",
                        boxShadow: "0 1px 3px #0008",
                        "&::after": {
                            content: '""',
                            position: "absolute",
                            width: "38%",
                            height: "38%",
                            borderRadius: "50%",
                            bgcolor: "#171717",
                            left: index === 0 ? "45%" : "55%",
                            top: index === 0 ? "35%" : "45%",
                        },
                    }}
                />
            ))}
        </Box>
    );
}
