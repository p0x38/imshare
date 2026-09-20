import {
    Alert,
    Box,
    LinearProgress,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import { CloudUpload } from "@mui/icons-material";
import { useRef, useState } from "react";
import { api, apiUrl } from "../lib/api";

const MAX_FILES = 20;
const ACCEPTED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/avif",
] as const;
const ACCEPTED_IMAGE_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".avif",
] as const;
const ACCEPT_ATTRIBUTE = [
    ...ACCEPTED_IMAGE_EXTENSIONS,
    ...ACCEPTED_IMAGE_TYPES,
].join(", ");

interface UploadedFile {
    id: string;
    originalName?: string | null;
}

function uploadSingle(
    file: File,
    onProgress: (progress: number) => void,
): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiUrl("/v1/uploads"));
        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            onProgress(Math.min(100, (event.loaded / event.total) * 100));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText).data as UploadedFile);
                } catch {
                    reject(new Error(`Failed to upload "${file.name}": the server returned an invalid response.`));
                }
                return;
            }

            let serverMessage = "";
            try {
                const payload = JSON.parse(xhr.responseText) as {
                    error?: { message?: string };
                };
                serverMessage = payload.error?.message?.trim() ?? "";
            } catch {
                // Use the HTTP status when the response is not JSON.
            }

            const reason =
                serverMessage ||
                (xhr.status === 429
                    ? "Upload rate limit exceeded. Try again later."
                    : `The server returned HTTP ${xhr.status}.`);
            reject(new Error(`Failed to upload "${file.name}": ${reason}`));
        };
        xhr.onerror = () => reject(new Error(`Failed to upload "${file.name}": network error.`));
        xhr.onabort = () => reject(new Error(`Failed to upload "${file.name}": upload cancelled.`));
        const data = new FormData();
        data.append("file", file);
        xhr.send(data);
    });
}

export function UploadBox() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState("");
    const [error, setError] = useState("");

    async function handleFiles(files: FileList | File[]) {
        const candidates = Array.from(files);

        if (candidates.length > MAX_FILES) {
            setError(`You can select up to ${MAX_FILES} files at once.`);
            return;
        }

        const rejected = candidates.filter(
            (file) => !ACCEPTED_IMAGE_TYPES.includes(
                file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
            ),
        );
        const selected = candidates.filter(
            (file) => ACCEPTED_IMAGE_TYPES.includes(
                file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
            ),
        );
        if (rejected.length > 0) {
            setError(
                `Unsupported file${rejected.length === 1 ? "" : "s"}: ${rejected
                    .map((file) => `"${file.name}"`)
                    .join(", ")}. Please select JPEG, PNG, GIF, WebP, BMP, or AVIF images.`,
            );
        } else {
            setError("");
        }
        if (!selected.length) return;
        setBusy(true);
        let activeFile = "";
        try {
            const uploaded: UploadedFile[] = [];
            let completedBytes = 0;
            const totalBytes = selected.reduce((sum, file) => sum + file.size, 0);

            for (const [index, file] of selected.entries()) {
                activeFile = file.name;
                setCurrentFile(file.name);
                const fileSize = file.size;
                const uploadedFile = await uploadSingle(file, (fileProgress) => {
                    const loadedBytes = completedBytes + (fileSize * fileProgress) / 100;
                    setProgress(totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : 0);
                });
                uploaded.push(uploadedFile);
                completedBytes += fileSize;
                setProgress(totalBytes > 0 ? (completedBytes / totalBytes) * 100 : 100);
                if (index === selected.length - 1) setCurrentFile("");
            }

            if (uploaded.length === 1) {
                const upload = uploaded[0];
                if (!upload) throw new Error("Upload failed.");
                location.href = "/posts/new/?uploadId=" + encodeURIComponent(upload.id);
                return;
            }

            setCurrentFile("Creating draft posts…");
            try {
                await api("/v1/posts/batch", {
                    method: "POST",
                    body: JSON.stringify({ uploadIds: uploaded.map((upload) => upload.id) }),
                });
            } catch (cause) {
                const reason = cause instanceof Error ? cause.message : "the server returned an unknown error.";
                throw new Error(
                    `Failed to create draft posts from ${uploaded.length} uploaded files: ${reason}`,
                );
            }
            location.href = "/dashboard/posts/";
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : activeFile
                      ? `Failed to upload "${activeFile}": unknown error.`
                      : "Failed to upload the selected files: unknown error.",
            );
        } finally {
            setBusy(false);
            setProgress(0);
            setCurrentFile("");
        }
    }

    return (
        <Stack spacing={1}>
            <Paper
                variant="outlined"
                component="button"
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void handleFiles(event.dataTransfer.files);
                }}
                sx={{
                    width: "100%",
                    boxSizing: "border-box",
                    p: { xs: 1.5, sm: 2 },
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    cursor: busy ? "wait" : "pointer",
                    borderStyle: "dashed",
                    borderWidth: 2,
                    borderColor: dragging ? "primary.main" : "divider",
                    bgcolor: dragging ? "action.hover" : "background.paper",
                    transition: "border-color 120ms ease, background-color 120ms ease",
                }}
            >
                <CloudUpload />
                <Box>
                    <Typography variant="body2" fontWeight={600}>
                        {busy ? "Uploading…" : "Drag & Drop, or select"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        JPEG, PNG, GIF, WebP, BMP, or AVIF · Up to {MAX_FILES} files
                    </Typography>
                </Box>
                <input
                    ref={inputRef}
                    hidden
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    multiple
                    onChange={(event) => {
                        const files = event.target.files;

                        if (!files) return;

                        if (files.length > MAX_FILES) {
                            setError(`You can select up to ${MAX_FILES} files at once.`);
                            event.target.value = "";
                            return;
                        }

                        void handleFiles(files);
                        event.target.value = "";
                    }}
                />
            </Paper>
            {busy ? (
                <Stack spacing={0.5}>
                    <LinearProgress variant="determinate" value={progress} />
                    <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                        {currentFile
                            ? `Uploading: ${currentFile} · ${Math.round(progress)}%`
                            : `${Math.round(progress)}% uploaded`}
                    </Typography>
                </Stack>
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
    );
}
