import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
    plugins: [react()],
    root: ".",
    publicDir: "public",
    build: {
        outDir: "dist/client",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                home: path.resolve(__dirname, "src/client/entries/home.tsx"),
                posts: path.resolve(__dirname, "src/client/entries/posts.tsx"),
                post: path.resolve(__dirname, "src/client/entries/post.tsx"),
                account: path.resolve(__dirname, "src/client/entries/account.tsx"),
                dashboard: path.resolve(__dirname, "src/client/entries/dashboard.tsx"),
                taxonomy: path.resolve(__dirname, "src/client/entries/taxonomy.tsx"),
            },
            output: {
                manualChunks: {
                    react: ["react", "react-dom"],
                    mui: ["@mui/material", "@mui/icons-material"],
                },
            },
        },
    },
});
