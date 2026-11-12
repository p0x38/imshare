import type {
    AvatarDecorationProps,
    AvatarDecorationSettings,
    AvatarDecorationSide,
    AvatarDecorationSize,
} from "./types";

interface GodzillaDorsalPlatesProps extends AvatarDecorationProps {
    settings?: AvatarDecorationSettings<"godzilla-dorsal-plates">;
}

const CENTER = 50;
const RIM = 50;
const SINK = 2;
const LEAN = 0.2;

const COLORS = {
    fill: "#287b38",
    shade: "#0d3b1a",
    edge: "#baff91",
    ridge: "#e0ffc5",
};

const SIZE_SCALE: Record<AvatarDecorationSize, number> = {
    small: 0.8,
    normal: 1,
    large: 1.2,
};

const OUTLINE: [number, number][] = [
    [-0.5, 0],
    [-0.36, 0.3],
    [-0.5, 0.4],
    [-0.22, 0.62],
    [-0.34, 0.74],
    [0, 1],
    [0.34, 0.74],
    [0.22, 0.62],
    [0.5, 0.4],
    [0.36, 0.3],
    [0.5, 0],
];

const SHADE: [number, number][] = [[0, 0], [0, 1], ...OUTLINE.slice(6)];

const RIDGE: [number, number][] = [
    [0, 0.1],
    [0, 0.8],
];

const PLATE_SPECS = [
    { angle: 24, height: 9 },
    { angle: 46, height: 13 },
    { angle: 68, height: 18 },
    { angle: 90, height: 22 },
    { angle: 112, height: 17 },
    { angle: 134, height: 13 },
    { angle: 156, height: 8 },
];

const num = (n: number) => Number(n.toFixed(2));

function buildPlate(angleDeg: number, height: number, dir: 1 | -1, scale: number) {
    const scaledHeight = height * scale;
    const width = (12 + height * 0.55) * scale;

    const a = (angleDeg * Math.PI) / 180;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    const base = RIM - SINK;

    const point = ([u, v]: [number, number]) => {
        const across = dir * (u * width + LEAN * v * scaledHeight);
        const out = base + v * scaledHeight;

        return `${num(CENTER + across * cos + out * sin)} ${num(
            CENTER + across * sin - out * cos,
        )}`;
    };

    const line = (points: [number, number][]) => "M " + points.map(point).join(" L ");

    return {
        height: scaledHeight,
        fill: line(OUTLINE) + " Z",
        edge: line(OUTLINE),
        shade: line(SHADE) + " Z",
        ridge: line(RIDGE),
    };
}

function buildSide(side: AvatarDecorationSide, scale: number) {
    const dir = side === "right" ? 1 : -1;

    return PLATE_SPECS.map((plate) => buildPlate(dir * plate.angle, plate.height, dir, scale)).sort(
        (a, b) => a.height - b.height,
    );
}

export function GodzillaDorsalPlates({ size: avatarSize, settings }: GodzillaDorsalPlatesProps) {
    const side = settings?.side ?? "right";
    const decorationSize = settings?.size ?? "normal";

    const plates = buildSide(side, SIZE_SCALE[decorationSize]);
    const stroke = Math.max(1, avatarSize * 0.022);

    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                overflow: "visible",
                pointerEvents: "none",
                zIndex: 2,
            }}
        >
            {plates.map((plate, index) => (
                <g key={index}>
                    <path d={plate.fill} fill={COLORS.fill} />

                    <path d={plate.shade} fill={COLORS.shade} opacity="0.45" />

                    <path
                        d={plate.edge}
                        fill="none"
                        stroke={COLORS.edge}
                        strokeWidth={stroke}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                    />

                    <path
                        d={plate.ridge}
                        fill="none"
                        stroke={COLORS.ridge}
                        strokeWidth={stroke * 0.7}
                        strokeLinecap="round"
                        opacity="0.7"
                        vectorEffect="non-scaling-stroke"
                    />
                </g>
            ))}
        </svg>
    );
}
