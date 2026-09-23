import { Box, Button, Slider, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";

const OUTPUT_SIZE = 512;
const OUTPUT_ASPECT_RATIO = 1;
const MAX_RASTER_SIZE = 4096;

interface Point {
    x: number;
    y: number;
}

type PointQuad = [Point, Point, Point, Point];
type Matrix = number[][];

interface ImageInfo {
    width: number;
    height: number;
}

interface DragState {
    pointerId: number;
    kind: "move" | "point";
    pointIndex?: number;
    startX: number;
    startY: number;
    originPoints: PointQuad;
}

function getMatrixValue(matrix: Matrix, row: number, column: number): number {
    const values = matrix[row];
    const value = values?.[column];
    if (value === undefined) throw new Error("Invalid homography matrix index.");
    return value;
}

function setMatrixValue(matrix: Matrix, row: number, column: number, value: number): void {
    const values = matrix[row];
    if (!values || values[column] === undefined) {
        throw new Error("Invalid homography matrix index.");
    }
    values[column] = value;
}

function getQuadPoint(points: PointQuad, index: number): Point {
    const point = points[index];
    if (!point) throw new Error("Invalid crop point index.");
    return point;
}

type Homography = [number, number, number, number, number, number, number, number];

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function solveHomography(source: PointQuad): Homography {
    const target: PointQuad = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
    ];
    const matrix: Matrix = [
        [target[0].x, target[0].y, 1, 0, 0, 0, -source[0].x * target[0].x, -source[0].x * target[0].y, source[0].x],
        [0, 0, 0, target[0].x, target[0].y, 1, -source[0].y * target[0].x, -source[0].y * target[0].y, source[0].y],
        [target[1].x, target[1].y, 1, 0, 0, 0, -source[1].x * target[1].x, -source[1].x * target[1].y, source[1].x],
        [0, 0, 0, target[1].x, target[1].y, 1, -source[1].y * target[1].x, -source[1].y * target[1].y, source[1].y],
        [target[2].x, target[2].y, 1, 0, 0, 0, -source[2].x * target[2].x, -source[2].x * target[2].y, source[2].x],
        [0, 0, 0, target[2].x, target[2].y, 1, -source[2].y * target[2].x, -source[2].y * target[2].y, source[2].y],
        [target[3].x, target[3].y, 1, 0, 0, 0, -source[3].x * target[3].x, -source[3].x * target[3].y, source[3].x],
        [0, 0, 0, target[3].x, target[3].y, 1, -source[3].y * target[3].x, -source[3].y * target[3].y, source[3].y],
    ];

    for (let column = 0; column < 8; column += 1) {
        let pivot = column;
        for (let row = column + 1; row < 8; row += 1) {
            if (
                Math.abs(getMatrixValue(matrix, row, column)) >
                Math.abs(getMatrixValue(matrix, pivot, column))
            ) {
                pivot = row;
            }
        }

        const pivotValue = getMatrixValue(matrix, pivot, column);
        if (Math.abs(pivotValue) < 1e-10) {
            throw new Error("The crop points are too close together.");
        }

        [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];

        const divisor = getMatrixValue(matrix, column, column);
        for (let j = column; j < 9; j += 1) {
            setMatrixValue(
                matrix,
                column,
                j,
                getMatrixValue(matrix, column, j) / divisor,
            );
        }

        for (let row = 0; row < 8; row += 1) {
            if (row === column) continue;
            const factor = getMatrixValue(matrix, row, column);
            if (factor === 0) continue;
            for (let j = column; j < 9; j += 1) {
                setMatrixValue(
                    matrix,
                    row,
                    j,
                    getMatrixValue(matrix, row, j) -
                        factor * getMatrixValue(matrix, column, j),
                );
            }
        }
    }

    return [
        getMatrixValue(matrix, 0, 8),
        getMatrixValue(matrix, 1, 8),
        getMatrixValue(matrix, 2, 8),
        getMatrixValue(matrix, 3, 8),
        getMatrixValue(matrix, 4, 8),
        getMatrixValue(matrix, 5, 8),
        getMatrixValue(matrix, 6, 8),
        getMatrixValue(matrix, 7, 8),
    ];
}

function isValidQuadrilateral(points: PointQuad): boolean {
    const [current, next, afterNext, fourth] = points;
    const crosses = [
        (next.x - current.x) * (afterNext.y - next.y) -
            (next.y - current.y) * (afterNext.x - next.x),
        (afterNext.x - next.x) * (fourth.y - afterNext.y) -
            (afterNext.y - next.y) * (fourth.x - afterNext.x),
        (fourth.x - afterNext.x) * (current.y - fourth.y) -
            (fourth.y - afterNext.y) * (current.x - fourth.x),
        (current.x - fourth.x) * (next.y - current.y) -
            (current.y - fourth.y) * (next.x - current.x),
    ];

    return !(crosses.some((cross) => cross > 1e-5) && crosses.some((cross) => cross < -1e-5));
}

function warpImage(
    image: HTMLImageElement,
    sourcePoints: PointQuad,
    imageInfo: ImageInfo,
): Promise<Blob> {
    const rasterScale = Math.min(
        1,
        MAX_RASTER_SIZE / Math.max(imageInfo.width, imageInfo.height),
    );
    const width = Math.max(1, Math.round(imageInfo.width * rasterScale));
    const height = Math.max(1, Math.round(imageInfo.height * rasterScale));

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Unable to create an image canvas.");

    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = "high";
    sourceContext.drawImage(image, 0, 0, width, height);
    const sourceData = sourceContext.getImageData(0, 0, width, height).data;

    const [sourceTopLeft, sourceTopRight, sourceBottomRight, sourceBottomLeft] =
        sourcePoints;
    const rasterPoints: PointQuad = [
        { x: sourceTopLeft.x * rasterScale, y: sourceTopLeft.y * rasterScale },
        { x: sourceTopRight.x * rasterScale, y: sourceTopRight.y * rasterScale },
        { x: sourceBottomRight.x * rasterScale, y: sourceBottomRight.y * rasterScale },
        { x: sourceBottomLeft.x * rasterScale, y: sourceBottomLeft.y * rasterScale },
    ];
    const homography = solveHomography(rasterPoints);

    const outputCanvas = document.createElement("canvas");
    const outputWidth = OUTPUT_SIZE;
    const outputHeight = Math.round(outputWidth / OUTPUT_ASPECT_RATIO);
    if (outputWidth !== outputHeight) {
        throw new Error("The avatar transform must use a 1:1 aspect ratio.");
    }
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) throw new Error("Unable to create the output image.");

    const output = outputContext.createImageData(OUTPUT_SIZE, OUTPUT_SIZE);

    for (let y = 0; y < outputHeight; y += 1) {
        const v = y / (outputHeight - 1);
        for (let x = 0; x < outputWidth; x += 1) {
            const u = x / (outputWidth - 1);
            const denominator = homography[6] * u + homography[7] * v + 1;
            if (Math.abs(denominator) < 1e-8) continue;

            const sourceX =
                (homography[0] * u + homography[1] * v + homography[2]) / denominator;
            const sourceY =
                (homography[3] * u + homography[4] * v + homography[5]) / denominator;

            const clampedX = Math.min(width - 1, Math.max(0, sourceX));
            const clampedY = Math.min(height - 1, Math.max(0, sourceY));
            const x0 = Math.floor(clampedX);
            const y0 = Math.floor(clampedY);
            const x1 = Math.min(width - 1, x0 + 1);
            const y1 = Math.min(height - 1, y0 + 1);
            const xWeight = clampedX - x0;
            const yWeight = clampedY - y0;

            const topLeft = (y0 * width + x0) * 4;
            const topRight = (y0 * width + x1) * 4;
            const bottomLeft = (y1 * width + x0) * 4;
            const bottomRight = (y1 * width + x1) * 4;
            const outputOffset = (y * outputWidth + x) * 4;

            for (let channel = 0; channel < 4; channel += 1) {
                const topLeftValue = sourceData[topLeft + channel] ?? 0;
                const topRightValue = sourceData[topRight + channel] ?? 0;
                const bottomLeftValue = sourceData[bottomLeft + channel] ?? 0;
                const bottomRightValue = sourceData[bottomRight + channel] ?? 0;
                const top =
                    topLeftValue * (1 - xWeight) +
                    topRightValue * xWeight;
                const bottom =
                    bottomLeftValue * (1 - xWeight) +
                    bottomRightValue * xWeight;
                output.data[outputOffset + channel] =
                    top * (1 - yWeight) + bottom * yWeight;
            }
        }
    }

    outputContext.putImageData(output, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
        outputCanvas.toBlob(
            (blob) =>
                blob
                    ? resolve(blob)
                    : reject(new Error("Unable to encode the transformed image.")),
            "image/png",
        );
    });
}

export function ProfilePictureCropper({
    file,
    onCancel,
    onConfirm,
}: {
    file: File;
    onCancel: () => void;
    onConfirm: (blob: Blob) => void | Promise<void>;
}) {
    const cropRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const dragRef = useRef<DragState | null>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [cropSize, setCropSize] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [points, setPoints] = useState<PointQuad>([
        { x: 0.12, y: 0.12 },
        { x: 0.88, y: 0.12 },
        { x: 0.88, y: 0.88 },
        { x: 0.12, y: 0.88 },
    ]);
    const [working, setWorking] = useState(false);

    useEffect(() => {
        const next = URL.createObjectURL(file);
        setSrc(next);
        setImageInfo(null);
        setZoom(1);
        setPoints([
            { x: 0.12, y: 0.12 },
            { x: 0.88, y: 0.12 },
            { x: 0.88, y: 0.88 },
            { x: 0.12, y: 0.88 },
        ]);
        return () => URL.revokeObjectURL(next);
    }, [file]);

    useEffect(() => {
        const element = cropRef.current;
        if (!element) return;

        const update = () => {
            const nextSize = element.clientWidth;
            if (nextSize > 0) setCropSize(nextSize);
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, [imageInfo, cropSize]);

    useEffect(() => {
        if (!src) return;
        const image = new Image();
        image.onload = () =>
            setImageInfo({
                width: image.naturalWidth,
                height: image.naturalHeight,
            });
        image.onerror = () => setImageInfo(null);
        image.src = src;
    }, [src]);

    const renderInfo = useMemo(() => {
        if (!imageInfo || cropSize <= 0) return null;
        const baseScale = Math.max(
            cropSize / imageInfo.width,
            cropSize / imageInfo.height,
        );
        const scale = baseScale * zoom;
        return {
            scale,
            width: imageInfo.width * scale,
            height: imageInfo.height * scale,
            left: (cropSize - imageInfo.width * scale) / 2,
            top: (cropSize - imageInfo.height * scale) / 2,
        };
    }, [cropSize, imageInfo, zoom]);

    function resetCrop() {
        setZoom(1);
        setPoints([
            { x: 0.12, y: 0.12 },
            { x: 0.88, y: 0.12 },
            { x: 0.88, y: 0.88 },
            { x: 0.12, y: 0.88 },
        ]);
    }

    function changeZoom(nextZoom: number) {
        if (nextZoom < 1 || nextZoom > 3) return;
        setZoom(nextZoom);
    }

    function beginDrag(
        event: React.PointerEvent<HTMLElement>,
        kind: "move" | "point",
        pointIndex?: number,
    ) {
        dragRef.current = {
            pointerId: event.pointerId,
            kind,
            pointIndex,
            startX: event.clientX,
            startY: event.clientY,
            originPoints: [
        { ...points[0] },
        { ...points[1] },
        { ...points[2] },
        { ...points[3] },
    ],
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.stopPropagation();
    }

    function move(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || cropSize <= 0) return;
        const dx = (event.clientX - drag.startX) / cropSize;
        const dy = (event.clientY - drag.startY) / cropSize;

        if (drag.kind === "move") {
                setPoints([
                {
                    x: clamp01(drag.originPoints[0].x + dx),
                    y: clamp01(drag.originPoints[0].y + dy),
                },
                {
                    x: clamp01(drag.originPoints[1].x + dx),
                    y: clamp01(drag.originPoints[1].y + dy),
                },
                {
                    x: clamp01(drag.originPoints[2].x + dx),
                    y: clamp01(drag.originPoints[2].y + dy),
                },
                {
                    x: clamp01(drag.originPoints[3].x + dx),
                    y: clamp01(drag.originPoints[3].y + dy),
                },
            ]);
            return;
        }

        const pointIndex = drag.pointIndex;
        if (
            pointIndex === undefined ||
            pointIndex < 0 ||
            pointIndex > 3
        ) {
            return;
        }
        setPoints(() => {
            const next: PointQuad = [
                { ...drag.originPoints[0] },
                { ...drag.originPoints[1] },
                { ...drag.originPoints[2] },
                { ...drag.originPoints[3] },
            ];
            const origin = getQuadPoint(drag.originPoints, pointIndex);
            next[pointIndex] = {
                x: clamp01(origin.x + dx),
                y: clamp01(origin.y + dy),
            };
            return next;
        });
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
        if (!imageRef.current || !imageInfo || !renderInfo || working) return;
        if (!isValidQuadrilateral(points)) {
            setWorking(false);
            return;
        }
        setWorking(true);
        try {
            const toSourcePoint = (point: Point): Point => ({
                x: Math.min(
                    imageInfo.width,
                    Math.max(
                        0,
                        (point.x * cropSize - renderInfo.left) / renderInfo.scale,
                    ),
                ),
                y: Math.min(
                    imageInfo.height,
                    Math.max(
                        0,
                        (point.y * cropSize - renderInfo.top) / renderInfo.scale,
                    ),
                ),
            });
            const sourcePoints: PointQuad = [
                toSourcePoint(points[0]),
                toSourcePoint(points[1]),
                toSourcePoint(points[2]),
                toSourcePoint(points[3]),
            ];
            const blob = await warpImage(imageRef.current, sourcePoints, imageInfo);
            await onConfirm(blob);
        } finally {
            setWorking(false);
        }
    }

    if (!src)
        return <Typography color="text.secondary">Loading image…</Typography>;

    if (!imageInfo)
        return (
            <Stack spacing={2} sx={{ py: 2 }}>
                <Typography color="text.secondary">
                    Unable to read this image. Please choose another file.
                </Typography>
                <Button onClick={onCancel}>Back</Button>
            </Stack>
        );

    if (!renderInfo)
        return (
            <Stack spacing={2} sx={{ py: 1 }}>
                <Box
                    ref={cropRef}
                    sx={{
                        width: "100%",
                        maxWidth: 420,
                        mx: "auto",
                        aspectRatio: "1 / 1",
                        visibility: "hidden",
                    }}
                />
                <Typography color="text.secondary">Preparing image…</Typography>
            </Stack>
        );

    const displayPoints = points.map((point) => ({
        x: point.x * cropSize,
        y: point.y * cropSize,
    }));

    const path = [
        `M 0 0 H ${cropSize} V ${cropSize} H 0 Z`,
        ...displayPoints.map((point, index) =>
            index === 0
                ? `M ${point.x} ${point.y}`
                : `L ${point.x} ${point.y}`,
        ),
        "Z",
    ].join(" ");

    return (
        <Stack spacing={2} sx={{ py: 1 }}>
            <Box
                ref={cropRef}
                sx={{
                    width: "100%",
                    maxWidth: 420,
                    mx: "auto",
                    aspectRatio: "1 / 1",
                    overflow: "hidden",
                    position: "relative",
                    bgcolor: "#202020",
                    borderRadius: 2,
                    touchAction: "none",
                    userSelect: "none",
                    cursor: "grab",
                }}
                onPointerDown={(event) => beginDrag(event, "move")}
                onPointerMove={move}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <Box
                    component="img"
                    ref={imageRef}
                    src={src}
                    alt="Profile picture crop"
                    draggable={false}
                    sx={{
                        position: "absolute",
                        display: "block",
                        width: renderInfo.width,
                        height: renderInfo.height,
                        maxWidth: "none",
                        left: renderInfo.left,
                        top: renderInfo.top,
                        userSelect: "none",
                    }}
                />
                <Box
                    component="svg"
                    viewBox={`0 0 ${cropSize} ${cropSize}`}
                    preserveAspectRatio="none"
                    aria-hidden
                    sx={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                    }}
                >
                    <path
                        d={path}
                        fill="rgba(0,0,0,0.35)"
                        fillRule="evenodd"
                        pointerEvents="none"
                    />
                    <polyline
                        points={displayPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                        fill="none"
                        stroke="white"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                    />
                    <line
                        x1={displayPoints[3]?.x ?? 0}
                        y1={displayPoints[3]?.y ?? 0}
                        x2={displayPoints[0]?.x ?? 0}
                        y2={displayPoints[0]?.y ?? 0}
                        stroke="white"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                    />
                </Box>
                {displayPoints.map((point, index) => (
                    <Box
                        key={index}
                        component="button"
                        type="button"
                        aria-label={`Move crop corner ${index + 1}`}
                        onPointerDown={(event) => beginDrag(event, "point", index)}
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
                            cursor: "grab",
                            "&:active": { cursor: "grabbing" },
                        }}
                    />
                ))}
                <Box
                    sx={{
                        position: "absolute",
                        inset: "12%",
                        border: 1,
                        borderColor: "rgba(255,255,255,0.5)",
                        borderRadius: "50%",
                        boxSizing: "border-box",
                        pointerEvents: "none",
                    }}
                />
            </Box>
            <Stack spacing={0.5}>
                <Typography variant="body2" fontWeight={600}>
                    Zoom
                </Typography>
                <Slider
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.01}
                    onChange={(_, value) =>
                        changeZoom(Array.isArray(value) ? value[0] ?? 1 : value)
                    }
                    valueLabelDisplay="auto"
                    aria-label="Profile picture zoom"
                />
            </Stack>
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
            >
                <Typography variant="body2" color="text.secondary">
                    Drag the four corners to straighten and frame your avatar. Drag inside the
                    image to move the whole selection.
                </Typography>
                <Button size="small" onClick={resetCrop} disabled={working}>
                    Reset
                </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
                The selected quadrilateral is perspective-corrected into a 512×512 square before
                your avatar is saved.
            </Typography>
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button onClick={onCancel} disabled={working}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={() => void confirm()} disabled={working}>
                    {working ? "Transforming…" : "Use this picture"}
                </Button>
            </Stack>
        </Stack>
    );
}
