import { Box } from "@mui/material";

import type { AvatarDecorationProps } from "./types";

export function RadioactiveGlow({ size }: AvatarDecorationProps) {
    return (
        <Box
            aria-hidden="true"
            sx={{
                position: "absolute",
                inset: -Math.max(2, size * 0.045),
                borderRadius: "50%",
                border: "2px solid rgba(139, 255, 76, 0.9)",
                boxShadow: `
                    0 0 5px rgba(139, 255, 76, 0.8),
                    0 0 12px rgba(91, 255, 45, 0.5),
                    0 0 22px rgba(91, 255, 45, 0.25)
                `,
                pointerEvents: "none",
                zIndex: 0,
            }}
        />
    );
}
