import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: path.resolve(process.cwd(), "public/build"),
        emptyOutDir: true,
        manifest: "manifest.json",
        rollupOptions: {
            input: {
                post: path.resolve(process.cwd(), "src/client/posts/main.tsx"),
            },
        },
    },
});
