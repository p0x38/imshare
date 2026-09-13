import { Box, Fade, Grow } from "@mui/material";
import type { ReactElement, ReactNode } from "react";
import { useThemeSettings } from "./App";

interface MotionProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
}

const motionEase = "cubic-bezier(0.22, 1, 0.36, 1)";

export function PageTransition({ children, duration = 420 }: MotionProps): ReactElement {
    const { settings } = useThemeSettings();

    if (!settings.animations) {
        return <>{children}</>;
    }

    return (
        <Fade
            in
            appear
            timeout={duration}
            easing={{ enter: motionEase }}
            style={{ willChange: "opacity, transform" }}
        >
            <Box>{children}</Box>
        </Fade>
    );
}

export function AnimatedItem({ children, delay = 0, duration = 360 }: MotionProps): ReactElement {
    const { settings } = useThemeSettings();

    if (!settings.animations) {
        return <>{children}</>;
    }

    return (
        <Grow
            in
            appear
            timeout={duration}
            style={{
                transformOrigin: "50% 0",
                transitionDelay: `${delay}ms`,
                willChange: "opacity, transform",
            }}
            easing={{ enter: motionEase }}
        >
            <Box>{children}</Box>
        </Grow>
    );
}
