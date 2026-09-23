import { Box, Button, Slider, Stack, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";

const OUTPUT_SIZE = 512;

interface CropPosition {
    x: number;
    y: number;
}

interface ImageInfo {
    width: number;
    height: number;
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
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [cropSize, setCropSize] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState<CropPosition>({ x: 0, y: 0 });
    const [working, setWorking] = useState(false);

    useEffect(() => {
        const next = URL.createObjectURL(file);
        setSrc(next);
        setImageInfo(null);
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        return () => URL.revokeObjectURL(next);
    }, [file]);

    useEffect(() => {
        const element = cropRef.current;
        if (!element) return;
        const update = () => setCropSize(element.clientWidth);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

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

    useEffect(() => {
        if (!imageInfo || cropSize <= 0) return;
        const scale = Math.max(
            cropSize / imageInfo.width,
            cropSize / imageInfo.height,
        ) * zoom;
        const width = imageInfo.width * scale;
        const height = imageInfo.height * scale;
        setPosition({
            x: (cropSize - width) / 2,
            y: (cropSize - height) / 2,
        });
    }, [imageInfo, cropSize]);

    function clamp(next: CropPosition, scale: number): CropPosition {
        if (!imageInfo || cropSize <= 0) return next;
        const width = imageInfo.width * scale;
        const height = imageInfo.height * scale;
        return {
            x: Math.min(0, Math.max(cropSize - width, next.x)),
            y: Math.min(0, Math.max(cropSize - height, next.y)),
        };
    }

    function changeZoom(nextZoom: number) {
        if (nextZoom < 1 || nextZoom > 3) return;
        if (!imageInfo || cropSize <= 0) {
            setZoom(nextZoom);
            return;
        }
        const baseScale = Math.max(
            cropSize / imageInfo.width,
            cropSize / imageInfo.height,
        );
        const oldScale = baseScale * zoom;
        const newScale = baseScale * nextZoom;
        if (oldScale !== newScale) {
            setPosition((current) =>
                clamp(
                    {
                        x:
                            cropSize / 2 -
                            ((cropSize / 2 - current.x) / oldScale) * newScale,
                        y:
                            cropSize / 2 -
                            ((cropSize / 2 - current.y) / oldScale) * newScale,
                    },
                    newScale,
                ),
            );
        }
        setZoom(nextZoom);
    }

    function move(event: React.PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId || !imageInfo || cropSize <= 0) return;
        const baseScale = Math.max(
            cropSize / imageInfo.width,
            cropSize / imageInfo.height,
        );
        setPosition(
            clamp(
                {
                    x: drag.originX + event.clientX - drag.startX,
                    y: drag.originY + event.clientY - drag.startY,
                },
                baseScale * zoom,
            ),
        );
    }

    async function confirm() {
        if (!src || !imageInfo || cropSize <= 0 || working) return;
        setWorking(true);
        try {
            const image =
                imageRef.current ??
                (await new Promise<HTMLImageElement>((resolve, reject) => {
                    const next = new Image();
                    next.onload = () => resolve(next);
                    next.onerror = () => reject(new Error("Unable to decode the selected image."));
                    next.src = src;
                }));
            const scale = Math.max(
                cropSize / imageInfo.width,
                cropSize / imageInfo.height,
            ) * zoom;
            const sourceSize = cropSize / scale;
            const sourceX = Math.max(
                0,
                Math.min(imageInfo.width - sourceSize, -position.x / scale),
            );
            const sourceY = Math.max(
                0,
                Math.min(imageInfo.height - sourceSize, -position.y / scale),
            );
            const canvas = document.createElement("canvas");
            canvas.width = OUTPUT_SIZE;
            canvas.height = OUTPUT_SIZE;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Unable to create an image crop.");
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
            context.drawImage(
                image,
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

    if (!src)
        return (
            <Typography color="text.secondary">Loading image…</Typography>
        );

    if (!imageInfo)
        return (
            <Stack spacing={2} sx={{ py: 2 }}>
                <Typography color="text.secondary">
                    Unable to read this image. Please choose another file.
                </Typography>
                <Button onClick={onCancel}>Back</Button>
            </Stack>
        );

    const scale = Math.max(
        cropSize / imageInfo.width,
        cropSize / imageInfo.height,
    ) * zoom;
    const renderedWidth = imageInfo.width * scale;
    const renderedHeight = imageInfo.height * scale;

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
                    bgcolor: "background.default",
                    borderRadius: 2,
                    touchAction: "none",
                    cursor: "grab",
                    userSelect: "none",
                    "&:active": { cursor: "grabbing" },
                }}
                onPointerDown={(event) => {
                    dragRef.current = {
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                        originX: position.x,
                        originY: position.y,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={move}
                onPointerUp={(event) => {
                    dragRef.current = null;
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                        event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => {
                    dragRef.current = null;
                }}
            >
                <Box
                    component="img"
                    ref={imageRef}
                    src={src}
                    alt="Profile picture crop"
                    draggable={false}
                    sx={{
                        position: "absolute",
                        width: renderedWidth,
                        height: renderedHeight,
                        maxWidth: "none",
                        left: position.x,
                        top: position.y,
                    }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        border: 2,
                        borderColor: "primary.main",
                        boxSizing: "border-box",
                    }}
                />
                <Box
                    sx={{
                        position: "absolute",
                        inset: "8%",
                        border: 1,
                        borderColor: "rgba(255,255,255,0.8)",
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
            <Typography variant="body2" color="text.secondary">
                Drag the image to choose the crop. The saved picture is a 512×512 square.
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
