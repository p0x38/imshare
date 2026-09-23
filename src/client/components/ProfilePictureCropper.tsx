import { Box, Button, Slider, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";

const OUTPUT_SIZE = 512;
const MIN_CROP_PIXELS = 48;
const INITIAL_CROP_FRACTION = 0.72;

interface Point {
    x: number;
    y: number;
}

interface ImageInfo {
    width: number;
    height: number;
}

interface CropState {
    centerX: number;
    centerY: number;
    sizeFraction: number;
}

type HandleIndex = 0 | 1 | 2 | 3;

interface DragState {
    pointerId: number;
    kind: "move" | "resize";
    handle?: HandleIndex;
    startX: number;
    startY: number;
    origin: CropState;
}

const DEFAULT_CROP: CropState = {
    centerX: 0.5,
    centerY: 0.5,
    sizeFraction: INITIAL_CROP_FRACTION,
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function getCropPixels(crop: CropState, width: number, height: number) {
    const size = crop.sizeFraction * Math.min(width, height);
    return {
        size,
        x: crop.centerX * width - size / 2,
        y: crop.centerY * height - size / 2,
    };
}

function constrainCrop(crop: CropState, width: number, height: number): CropState {
    if (width <= 0 || height <= 0) return crop;

    const size = crop.sizeFraction * Math.min(width, height);
    const halfWidth = size / (2 * width);
    const halfHeight = size / (2 * height);

    return {
        ...crop,
        centerX: clamp(crop.centerX, halfWidth, 1 - halfWidth),
        centerY: clamp(crop.centerY, halfHeight, 1 - halfHeight),
        sizeFraction: clamp(crop.sizeFraction, 0.25, 1),
    };
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
    const stageRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const dragRef = useRef<DragState | null>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [crop, setCrop] = useState<CropState>(DEFAULT_CROP);
    const [working, setWorking] = useState(false);

    useEffect(() => {
        const next = URL.createObjectURL(file);
        setSrc(next);
        setImageInfo(null);
        setStageSize({ width: 0, height: 0 });
        setCrop(DEFAULT_CROP);
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
        setCrop((current) => constrainCrop(current, stageSize.width, stageSize.height));
    }, [stageSize]);

    function resetCrop() {
        setCrop(DEFAULT_CROP);
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
            origin: { ...crop },
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
        const originPixels = getCropPixels(drag.origin, width, height);

        if (drag.kind === "move") {
            setCrop(
                constrainCrop(
                    {
                        ...drag.origin,
                        centerX: drag.origin.centerX + dx / width,
                        centerY: drag.origin.centerY + dy / height,
                    },
                    width,
                    height,
                ),
            );
            return;
        }

        if (drag.handle === undefined) return;

        const left = originPixels.x;
        const top = originPixels.y;
        const right = left + originPixels.size;
        const bottom = top + originPixels.size;

        let fixed: Point;
        let candidateSize: number;
        let maxSize: number;
        let nextX: number;
        let nextY: number;

        switch (drag.handle) {
            case 0: {
                fixed = { x: right, y: bottom };
                candidateSize = Math.max(fixed.x - (left + dx), fixed.y - (top + dy));
                maxSize = Math.min(fixed.x, fixed.y);
                break;
            }
            case 1: {
                fixed = { x: left, y: bottom };
                candidateSize = Math.max((right + dx) - fixed.x, fixed.y - (top + dy));
                maxSize = Math.min(width - fixed.x, fixed.y);
                break;
            }
            case 2: {
                fixed = { x: left, y: top };
                candidateSize = Math.max((right + dx) - fixed.x, (bottom + dy) - fixed.y);
                maxSize = Math.min(width - fixed.x, height - fixed.y);
                break;
            }
            case 3: {
                fixed = { x: right, y: top };
                candidateSize = Math.max(fixed.x - (left + dx), (bottom + dy) - fixed.y);
                maxSize = Math.min(fixed.x, height - fixed.y);
                break;
            }
        }

        const size = clamp(candidateSize, MIN_CROP_PIXELS, maxSize);
        if (size < MIN_CROP_PIXELS) return;

        switch (drag.handle) {
            case 0:
                nextX = fixed.x - size;
                nextY = fixed.y - size;
                break;
            case 1:
                nextX = fixed.x;
                nextY = fixed.y - size;
                break;
            case 2:
                nextX = fixed.x;
                nextY = fixed.y;
                break;
            case 3:
                nextX = fixed.x - size;
                nextY = fixed.y;
                break;
        }

        setCrop({
            centerX: (nextX + size / 2) / width,
            centerY: (nextY + size / 2) / height,
            sizeFraction: size / Math.min(width, height),
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
        if (!imageRef.current || !imageInfo || stageSize.width <= 0 || stageSize.height <= 0 || working) {
            return;
        }

        setWorking(true);
        try {
            const cropPixels = getCropPixels(crop, stageSize.width, stageSize.height);
            const sourceX = clamp(
                (cropPixels.x / stageSize.width) * imageInfo.width,
                0,
                imageInfo.width,
            );
            const sourceY = clamp(
                (cropPixels.y / stageSize.height) * imageInfo.height,
                0,
                imageInfo.height,
            );
            const sourceWidth = clamp(
                (cropPixels.size / stageSize.width) * imageInfo.width,
                1,
                imageInfo.width - sourceX,
            );
            const sourceHeight = clamp(
                (cropPixels.size / stageSize.height) * imageInfo.height,
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

    const cropPixels =
        stageSize.width > 0 && stageSize.height > 0
            ? getCropPixels(crop, stageSize.width, stageSize.height)
            : null;

    const handlePoints: Point[] = cropPixels
        ? [
              { x: cropPixels.x, y: cropPixels.y },
              { x: cropPixels.x + cropPixels.size, y: cropPixels.y },
              { x: cropPixels.x + cropPixels.size, y: cropPixels.y + cropPixels.size },
              { x: cropPixels.x, y: cropPixels.y + cropPixels.size },
          ]
        : [];

    return (
        <Stack spacing={2} sx={{ py: 1 }}>
            <Box
                ref={stageRef}
                sx={{
                    width: "100%",
                    maxWidth: 420,
                    maxHeight: "55vh",
                    mx: "auto",
                    aspectRatio: `${imageInfo.width} / ${imageInfo.height}`,
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

                {cropPixels ? (
                    <Box
                        sx={{
                            position: "absolute",
                            left: cropPixels.x,
                            top: cropPixels.y,
                            width: cropPixels.size,
                            height: cropPixels.size,
                            border: 2,
                            borderColor: "common.white",
                            boxSizing: "border-box",
                            pointerEvents: "none",
                            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.48)",
                        }}
                    >
                        <Box
                            sx={{
                                position: "absolute",
                                inset: "12%",
                                border: 2,
                                borderColor: "rgba(255,255,255,0.9)",
                                borderRadius: "50%",
                                boxSizing: "border-box",
                                pointerEvents: "none",
                            }}
                        />
                    </Box>
                ) : null}

                {cropPixels
                    ? handlePoints.map((point, index) => (
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
                                  cursor: "nwse-resize",
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
                        {Math.round(crop.sizeFraction * 100)}%
                    </Typography>
                </Stack>
                <Slider
                    value={crop.sizeFraction}
                    min={0.25}
                    max={1}
                    step={0.01}
                    onChange={(_, value) => {
                        const next = Array.isArray(value) ? value[0] ?? crop.sizeFraction : value;
                        const sizeFraction = typeof next === "number" ? next : crop.sizeFraction;
                        setCrop((current) =>
                            constrainCrop(
                                { ...current, sizeFraction },
                                stageSize.width,
                                stageSize.height,
                            ),
                        );
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
                    The full image stays visible. Drag the square to move it, or drag any corner
                    to resize it while keeping the crop exactly 1:1.
                </Typography>
                <Button size="small" onClick={resetCrop} disabled={working}>
                    Reset
                </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary">
                The circle shows the safe area for your avatar. It moves and scales together with
                the square crop, and the final image is saved as a 512×512 square.
            </Typography>

            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button onClick={onCancel} disabled={working}>
                    Cancel
                </Button>
                <Button variant="contained" onClick={() => void confirm()} disabled={working}>
                    {working ? "Cropping…" : "Use this picture"}
                </Button>
            </Stack>
        </Stack>
    );
}
