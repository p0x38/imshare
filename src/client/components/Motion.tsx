import { Box, Fade, Grow } from "@mui/material";
import type { ReactElement, ReactNode } from "react";

interface MotionProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
}

const motionEase = "cubic-bezier(0.22, 1, 0.36, 1)";

export function PageTransition({ children, duration = 420 }: MotionProps): ReactElement {
    return (
        <Fade
            in
            appear
            timeout={duration}
            easing={{ enter: motionEase }}
            style={{ willChange: "opacity, transform" }}
        >
            <Box
                sx={{
                    animation: `imshare-page-enter ${duration}ms ${motionEase}`,
                    "@media (prefers-reduced-motion: reduce)": {
                        animation: "none !important",
                        transition: "none !important",
                    },
                }}
            >
                {children}
            </Box>
        </Fade>
    );
}

export function AnimatedItem({ children, delay = 0, duration = 360 }: MotionProps): ReactElement {
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
            <Box
                sx={{
                    "@media (prefers-reduced-motion: reduce)": {
                        transition: "none !important",
                    },
                }}
            >
                {children}
            </Box>
        </Grow>
    );
}
