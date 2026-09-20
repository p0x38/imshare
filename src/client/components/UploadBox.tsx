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
                    reject(new Error("Invalid upload response."));
                }
            } else {
                reject(
                    new Error(
                        xhr.status === 429
                            ? "Upload rate limit exceeded."
                            : "Image upload failed.",
                    ),
                );
            }
        };
        xhr.onerror = () => reject(new Error("Image upload failed."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));
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
        const selected = Array.from(files).filter((file) => file.type.startsWith("image/"));
        if (!selected.length) return;
        setBusy(true);
        setError("");
        try {
            const uploaded: UploadedFile[] = [];
            let completedBytes = 0;
            const totalBytes = selected.reduce((sum, file) => sum + file.size, 0);

            for (const [index, file] of selected.entries()) {
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
            await api("/v1/posts/batch", {
                method: "POST",
                body: JSON.stringify({ uploadIds: uploaded.map((upload) => upload.id) }),
            });
            location.href = "/dashboard/posts/";
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Upload failed.");
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
                        Images only
                    </Typography>
                </Box>
                <input
                    ref={inputRef}
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                        if (event.target.files) void handleFiles(event.target.files);
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
