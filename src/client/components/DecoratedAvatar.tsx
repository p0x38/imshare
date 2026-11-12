import { Box } from "@mui/material";
import type { ComponentType, ReactNode } from "react";

import {
    GodzillaDorsalPlates,
    RadioactiveGlow,
    GooglyEyes,
    type AvatarDecorationId,
    type AvatarDecorationProps,
} from "./avatar-decorations";

interface DecoratedAvatarProps {
    children: ReactNode;
    size: number;
    decorationId?: string | null;
}

const decorationComponents: Record<AvatarDecorationId, ComponentType<AvatarDecorationProps>> = {
    "godzilla-dorsal-plates": GodzillaDorsalPlates,
    "godzilla-radioactive-glow": RadioactiveGlow,
    "april-fools-googly-eyes": GooglyEyes,
};

export function DecoratedAvatar({ children, size, decorationId }: DecoratedAvatarProps) {
    const Decoration =
        decorationId && decorationId in decorationComponents
            ? decorationComponents[decorationId as AvatarDecorationId]
            : undefined;

    return (
        <Box
            sx={{
                position: "relative",
                display: "inline-flex",
                width: size,
                height: size,
                flexShrink: 0,
                overflow: "visible",
                isolation: "isolate",
                verticalAlign: "middle",
            }}
        >
            <Box
                sx={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    height: "100%",
                    "& > *": {
                        width: "100%",
                        height: "100%",
                    },
                }}
            >
                {children}
            </Box>

            {Decoration ? <Decoration size={size} /> : null}
        </Box>
    );
}
