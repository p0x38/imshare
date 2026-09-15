import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
    plugins: [react()], publicDir: false,
    build: { outDir: "dist/client", emptyOutDir: true, rollupOptions: {
        input: {
            home: path.resolve(process.cwd(), "src/client/entries/home.tsx"), posts: path.resolve(process.cwd(), "src/client/entries/posts.tsx"), post: path.resolve(process.cwd(), "src/client/entries/post.tsx"), texts: path.resolve(process.cwd(), "src/client/entries/texts.tsx"), text: path.resolve(process.cwd(), "src/client/entries/text.tsx"), textEditor: path.resolve(process.cwd(), "src/client/entries/text-editor.tsx"), account: path.resolve(process.cwd(), "src/client/entries/account.tsx"), dashboard: path.resolve(process.cwd(), "src/client/entries/dashboard.tsx"), dashboardPosts: path.resolve(process.cwd(), "src/client/entries/dashboard-posts.tsx"), dashboardPost: path.resolve(process.cwd(), "src/client/entries/dashboard-post.tsx"), postEditor: path.resolve(process.cwd(), "src/client/entries/post-editor.tsx"), settings: path.resolve(process.cwd(), "src/client/entries/settings.tsx"), taxonomy: path.resolve(process.cwd(), "src/client/entries/taxonomy.tsx"), legacy: path.resolve(process.cwd(), "src/client/entries/legacy.tsx"), faq: path.resolve(process.cwd(), "src/client/entries/faq.tsx"), gitCommits: path.resolve(process.cwd(), "src/client/entries/git-commits.tsx"), error: path.resolve(process.cwd(), "src/client/entries/error.tsx")
        },
        output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]", manualChunks: { react: ["react", "react-dom"], mui: ["@mui/material", "@mui/icons-material"] } }
    } }
});
