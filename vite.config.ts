import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
    plugins: [react()],
    publicDir: false,
    build: {
        outDir: "public/client",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                home: path.resolve(process.cwd(), "src/client/entries/home.tsx"),
                posts: path.resolve(process.cwd(), "src/client/entries/posts.tsx"),
                account: path.resolve(process.cwd(), "src/client/entries/account.tsx"),
                dashboard: path.resolve(process.cwd(), "src/client/entries/dashboard.tsx"),
                taxonomy: path.resolve(process.cwd(), "src/client/entries/taxonomy.tsx"),
            },
            output: {
                entryFileNames: "[name].js",
                chunkFileNames: "chunks/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash][extname]",
                manualChunks: {
                    react: ["react", "react-dom"],
                    mui: ["@mui/material", "@mui/icons-material"],
                },
            },
        },
    },
});
