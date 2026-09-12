import { Fade, Grow } from "@mui/material";
import type { ReactElement, ReactNode } from "react";

interface MotionProps {
    children: ReactNode;
    delay?: number;
    duration?: number;
}

export function PageTransition({ children, duration = 420 }: MotionProps): ReactElement {
    return (
        <Fade in appear timeout={duration} easing="ease-out">
            <div>{children}</div>
        </Fade>
    );
}

export function AnimatedItem({ children, delay = 0, duration = 360 }: MotionProps): ReactElement {
    return (
        <Grow
            in
            appear
            timeout={{ enter: duration + delay, exit: duration }}
            style={{ transformOrigin: "50% 0" }}
            easing="ease-out"
        >
            <div>{children}</div>
        </Grow>
    );
}
