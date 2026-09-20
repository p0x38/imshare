import {
    Alert,
    Box,
    Button,
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

function uploadSingle(file: File): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", apiUrl("/v1/uploads"));
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText).data as UploadedFile);
                } catch {
                    reject(new Error("Invalid upload response."));
                }
            } else {
                reject(new Error(xhr.status === 429 ? "Upload rate limit exceeded." : "Image upload failed."));
            }
        };
        xhr.onerror = () => reject(new Error("Image upload failed."));
        const data = new FormData();
        data.append("file", file);
        xhr.send(data);
    });
}

export function UploadBox() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function handleFiles(files: FileList | File[]) {
        const selected = Array.from(files).filter((file) => file.type.startsWith("image/"));
        if (!selected.length) return;
        setBusy(true);
        setError("");
        try {
            const uploaded: UploadedFile[] = [];
            for (const file of selected) uploaded.push(await uploadSingle(file));

            if (uploaded.length === 1) {
                const upload = uploaded[0];
                if (!upload) throw new Error("Upload failed.");
                location.href = "/posts/new/?uploadId=" + encodeURIComponent(upload.id);
                return;
            }

            await api("/v1/posts/batch", {
                method: "POST",
                body: JSON.stringify({ uploadIds: uploaded.map((upload) => upload.id) }),
            });
            location.href = "/dashboard/posts/";
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Upload failed.");
        } finally {
            setBusy(false);
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
            {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
    );
}
