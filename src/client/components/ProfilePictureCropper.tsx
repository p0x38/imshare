import { Box, Button, Slider, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";

const OUTPUT_SIZE = 512;
const MIN_CROP_PIXELS = 48;
const INITIAL_CROP_FRACTION = 0.72;

interface Point {
    x: number;
    y: number;
}

type PointQuad = [Point, Point, Point, Point];
type HandleIndex = 0 | 1 | 2 | 3;

interface ImageInfo {
    width: number;
    height: number;
}

interface DragState {
    pointerId: number;
    kind: "move" | "resize";
    handle?: HandleIndex;
    startX: number;
    startY: number;
    originPoints: PointQuad;
}

const DEFAULT_POINTS: PointQuad = [
    { x: 0.14, y: 0.14 },
    { x: 0.86, y: 0.14 },
    { x: 0.86, y: 0.86 },
    { x: 0.14, y: 0.86 },
];

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function copyPoints(points: PointQuad): PointQuad {
    return [
        { ...points[0] },
        { ...points[1] },
        { ...points[2] },
        { ...points[3] },
    ];
}

function pointsToPixels(points: PointQuad, width: number, height: number): PointQuad {
    return [
        { x: points[0].x * width, y: points[0].y * height },
        { x: points[1].x * width, y: points[1].y * height },
        { x: points[2].x * width, y: points[2].y * height },
        { x: points[3].x * width, y: points[3].y * height },
    ];
}

function getCropSize(points: PointQuad, width: number): number {
    return Math.max(0, (points[1].x - points[0].x) * width);
}

function clampPointsToStage(points: PointQuad): PointQuad {
    return [
        { x: clamp(points[0].x, 0, 1), y: clamp(points[0].y, 0, 1) },
        { x: clamp(points[1].x, 0, 1), y: clamp(points[1].y, 0, 1) },
        { x: clamp(points[2].x, 0, 1), y: clamp(points[2].y, 0, 1) },
        { x: clamp(points[3].x, 0, 1), y: clamp(points[3].y, 0, 1) },
    ];
}

function constrainSquare(points: PointQuad, width: number, height: number): PointQuad {
    if (width <= 0 || height <= 0) return points;

    const left = points[0].x * width;
    const top = points[0].y * height;
    const size = Math.min(
        points[1].x * width - left,
        points[3].y * height - top,
    );
    const maxSize = Math.min(width - left, height - top);
    const nextSize = clamp(size, MIN_CROP_PIXELS, maxSize);

    return [
        { x: left / width, y: top / height },
        { x: (left + nextSize) / width, y: top / height },
        { x: (left + nextSize) / width, y: (top + nextSize) / height },
        { x: left / width, y: (top + nextSize) / height },
    ];
}

export function ProfilePictureCropper({
    file,
    onCancel,
    onConfirm,
    showCircle = true,
    actionLabel = "Use this picture",
}: {
    file: File;
    onCancel: () => void;
    onConfirm: (blob: Blob) => void | Promise<void>;
    showCircle?: boolean;
    actionLabel?: string;
}) {
    const stageRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const dragRef = useRef<DragState | null>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [points, setPoints] = useState<PointQuad>(DEFAULT_POINTS);
    const [working, setWorking] = useState(false);

    useEffect(() => {
        const next = URL.createObjectURL(file);
        setSrc(next);
        setImageInfo(null);
        setStageSize({ width: 0, height: 0 });
        setPoints(DEFAULT_POINTS);
        return () => URL.revokeObjectURL(next);
    }, [file]);

    useEffect(() => {
        if (!src) return;

        const image = new Image();
        image.onload = () => {
            setImageInfo({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        };
        image.onerror = () => setImageInfo(null);
        image.src = src;
    }, [src]);

    useEffect(() => {
        const element = stageRef.current;
        if (!element) return;

        const update = () => {
            setStageSize({
                width: element.clientWidth,
                height: element.clientHeight,
            });
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [imageInfo]);

    useEffect(() => {
        if (stageSize.width <= 0 || stageSize.height <= 0) return;
        setPoints((current) =>
            constrainSquare(current, stageSize.width, stageSize.height),
        );
    }, [stageSize]);

    const cropFraction = useMemo(() => {
        if (stageSize.width <= 0 || stageSize.height <= 0) return INITIAL_CROP_FRACTION;
        return getCropSize(points, stageSize.width) / Math.min(stageSize.width, stageSize.height);
    }, [points, stageSize]);

    function resetCrop() {
        setPoints(DEFAULT_POINTS);
    }

    function beginDrag(
        event: React.PointerEvent<HTMLElement>,
        kind: DragState["kind"],
        handle?: HandleIndex,
    ) {
        if (working || stageSize.width <= 0 || stageSize.height <= 0) return;

        dragRef.current = {
            pointerId: event.pointerId,
            kind,
            handle,
            startX: event.clientX,
            startY: event.clientY,
            originPoints: copyPoints(points),
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.stopPropagation();
    }

    function move(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const width = stageSize.width;
        const height = stageSize.height;
        if (width <= 0 || height <= 0) return;

        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;

        const origin = pointsToPixels(drag.originPoints, width, height);

        if (drag.kind === "move") {
            const cropWidth = origin[1].x - origin[0].x;
            const cropHeight = origin[3].y - origin[0].y;
            const nextLeft = clamp(origin[0].x + dx, 0, width - cropWidth);
            const nextTop = clamp(origin[0].y + dy, 0, height - cropHeight);

            setPoints([
                { x: nextLeft / width, y: nextTop / height },
                { x: (nextLeft + cropWidth) / width, y: nextTop / height },
                { x: (nextLeft + cropWidth) / width, y: (nextTop + cropHeight) / height },
                { x: nextLeft / width, y: (nextTop + cropHeight) / height },
            ]);
            return;
        }

        if (drag.handle === undefined) return;

        const left = origin[0].x;
        const top = origin[0].y;
        const right = origin[1].x;
        const bottom = origin[3].y;

        let fixed: Point;
        let candidateSize: number;
        let maxSize: number;

        switch (drag.handle) {
            case 0:
                fixed = { x: right, y: bottom };
                candidateSize = Math.max(fixed.x - (left + dx), fixed.y - (top + dy));
                maxSize = Math.min(fixed.x, fixed.y);
                break;
            case 1:
                fixed = { x: left, y: bottom };
                candidateSize = Math.max((right + dx) - fixed.x, fixed.y - (top + dy));
                maxSize = Math.min(width - fixed.x, fixed.y);
                break;
            case 2:
                fixed = { x: left, y: top };
                candidateSize = Math.max((right + dx) - fixed.x, (bottom + dy) - fixed.y);
                maxSize = Math.min(width - fixed.x, height - fixed.y);
                break;
            case 3:
                fixed = { x: right, y: top };
                candidateSize = Math.max(fixed.x - (left + dx), (bottom + dy) - fixed.y);
                maxSize = Math.min(fixed.x, height - fixed.y);
                break;
        }

        const size = clamp(candidateSize, MIN_CROP_PIXELS, maxSize);
        if (size < MIN_CROP_PIXELS) return;

        const next: PointQuad =
            drag.handle === 0
                ? [
                      { x: fixed.x - size, y: fixed.y - size },
                      { x: fixed.x, y: fixed.y - size },
                      { x: fixed.x, y: fixed.y },
                      { x: fixed.x - size, y: fixed.y },
                  ]
                : drag.handle === 1
                  ? [
                        { x: fixed.x, y: fixed.y - size },
                        { x: fixed.x + size, y: fixed.y - size },
                        { x: fixed.x + size, y: fixed.y },
                        { x: fixed.x, y: fixed.y },
                    ]
                  : drag.handle === 2
                    ? [
                          { x: fixed.x, y: fixed.y },
                          { x: fixed.x + size, y: fixed.y },
                          { x: fixed.x + size, y: fixed.y + size },
                          { x: fixed.x, y: fixed.y + size },
                      ]
                    : [
                          { x: fixed.x - size, y: fixed.y },
                          { x: fixed.x, y: fixed.y },
                          { x: fixed.x, y: fixed.y + size },
                          { x: fixed.x - size, y: fixed.y + size },
                      ];

        setPoints(
            clampPointsToStage(
                next.map((point) => ({
                    x: point.x / width,
                    y: point.y / height,
                })) as PointQuad,
            ),
        );
    }

    function endDrag(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }

    async function confirm() {
        if (
            !imageRef.current ||
            !imageInfo ||
            stageSize.width <= 0 ||
            stageSize.height <= 0 ||
            working
        ) {
            return;
        }

        setWorking(true);
        try {
            const topLeft = points[0];
            const topRight = points[1];
            const bottomLeft = points[3];
            const sourceX = clamp(topLeft.x * imageInfo.width, 0, imageInfo.width);
            const sourceY = clamp(topLeft.y * imageInfo.height, 0, imageInfo.height);
            const sourceWidth = clamp(
                (topRight.x - topLeft.x) * imageInfo.width,
                1,
                imageInfo.width - sourceX,
            );
            const sourceHeight = clamp(
                (bottomLeft.y - topLeft.y) * imageInfo.height,
                1,
                imageInfo.height - sourceY,
            );
            const sourceSize = Math.min(sourceWidth, sourceHeight);

            const canvas = document.createElement("canvas");
            canvas.width = OUTPUT_SIZE;
            canvas.height = OUTPUT_SIZE;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Unable to create the image crop.");

            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
            context.drawImage(
                imageRef.current,
                sourceX,
                sourceY,
                sourceSize,
                sourceSize,
                0,
                0,
                OUTPUT_SIZE,
                OUTPUT_SIZE,
            );

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(
                    (value) =>
                        value
                            ? resolve(value)
                            : reject(new Error("Unable to encode the cropped image.")),
                    "image/png",
                );
            });
            await onConfirm(blob);
        } finally {
            setWorking(false);
        }
    }

    if (!src) {
        return <Typography color="text.secondary">Loading image…</Typography>;
    }

    if (!imageInfo) {
        return (
            <Stack spacing={2} sx={{ py: 2 }}>
                <Typography color="text.secondary">
                    Unable to read this image. Please choose another file.
                </Typography>
                <Button onClick={onCancel}>Back</Button>
            </Stack>
        );
    }

    const displayPoints = pointsToPixels(points, stageSize.width, stageSize.height);
    const cropLeft = displayPoints[0].x;
    const cropTop = displayPoints[0].y;
    const cropSize = displayPoints[1].x - displayPoints[0].x;

    return (
        <Stack spacing={2} sx={{ py: 1 }}>
            <Box
                ref={stageRef}
                sx={{
                    width: "100%",
                    maxWidth: 420,
                    aspectRatio: `${imageInfo.width} / ${imageInfo.height}`,
                    maxHeight: "55vh",
                    mx: "auto",
                    position: "relative",
                    overflow: "hidden",
                    bgcolor: "#202020",
                    borderRadius: 2,
                    touchAction: "none",
                    userSelect: "none",
                }}
                onPointerMove={move}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerDown={(event) => beginDrag(event, "move")}
            >
                <Box
                    component="img"
                    ref={imageRef}
                    src={src}
                    alt="Profile picture crop"
                    draggable={false}
                    sx={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        objectFit: "fill",
                        userSelect: "none",
                    }}
                />

                {stageSize.width > 0 && stageSize.height > 0 ? (
                    <Box
                        sx={{
                            position: "absolute",
                            left: cropLeft,
                            top: cropTop,
                            width: cropSize,
                            height: cropSize,
                            border: 2,
                            borderColor: "common.white",
                            boxSizing: "border-box",
                            pointerEvents: "none",
                        }}
                    >
                        {showCircle ? (
                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    border: 2,
                                    borderColor: "rgba(255,255,255,0.95)",
                                    borderRadius: "50%",
                                    boxSizing: "border-box",
                                    pointerEvents: "none",
                                }}
                            />
                        ) : null}
                    </Box>
                ) : null}

                {stageSize.width > 0 && stageSize.height > 0
                    ? displayPoints.map((point, index) => (
                          <Box
                              key={index}
                              component="button"
                              type="button"
                              aria-label={`Resize crop corner ${index + 1}`}
                              onPointerDown={(event) =>
                                  beginDrag(event, "resize", index as HandleIndex)
                              }
                              sx={{
                                  position: "absolute",
                                  left: point.x,
                                  top: point.y,
                                  width: 24,
                                  height: 24,
                                  transform: "translate(-50%, -50%)",
                                  borderRadius: "50%",
                                  border: 2,
                                  borderColor: "common.white",
                                  bgcolor: "primary.main",
                                  boxShadow: 2,
                                  p: 0,
                                  m: 0,
                                  cursor:
                                      index === 0 || index === 2
                                          ? "nwse-resize"
                                          : "nesw-resize",
                                  touchAction: "none",
                              }}
                          />
                      ))
                    : null}
            </Box>

            <Stack spacing={0.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight={600}>
                        Crop size
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {Math.round(cropFraction * 100)}%
                    </Typography>
                </Stack>
                <Slider
                    value={cropFraction}
                    min={0.25}
                    max={1}
                    step={0.01}
                    onChange={(_, value) => {
                        const next = Array.isArray(value)
                            ? value[0] ?? cropFraction
                            : value;
                        if (typeof next !== "number") return;

                        const currentSize = cropSize;
                        const nextSize = next * Math.min(stageSize.width, stageSize.height);
                        if (currentSize <= 0 || nextSize <= 0) return;

                        const centerX = (cropLeft + currentSize / 2) / stageSize.width;
                        const centerY = (cropTop + currentSize / 2) / stageSize.height;
                        const halfWidth = nextSize / 2 / stageSize.width;
                        const halfHeight = nextSize / 2 / stageSize.height;

                        setPoints([
                            { x: centerX - halfWidth, y: centerY - halfHeight },
                            { x: centerX + halfWidth, y: centerY - halfHeight },
                            { x: centerX + halfWidth, y: centerY + halfHeight },
                            { x: centerX - halfWidth, y: centerY + halfHeight },
                        ]);
                    }}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(Number(value) * 100)}%`}
                    aria-label="Avatar crop size"
                    disabled={working || stageSize.width <= 0}
                />
            </Stack>

            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
            >
                <Typography variant="body2" color="text.secondary">
                    Drag the square to move it. Drag any of the four points to resize the square
                    while preserving its exact 1:1 aspect ratio.
                </Typography>
                <Button size="small" onClick={resetCrop} disabled={working}>
                    Reset
                </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary">
                The full image stays visible, the four corner points resize one shared 1:1 crop
                box, and the circle follows the crop box. The final avatar is saved as a 512×512
                square.
            </Typography>

            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button onClick={onCancel} disabled={working}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={() => void confirm()} disabled={working}>
                    {working ? "Cropping…" : actionLabel}
                </Button>
            </Stack>
        </Stack>
    );
}
