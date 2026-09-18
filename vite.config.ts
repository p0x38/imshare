import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
    plugins: [react()],
    publicDir: false,
    build: {
        outDir: "dist/client",
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            input: {
                home: path.resolve(process.cwd(), "src/client/entries/home.tsx"),
                posts: path.resolve(process.cwd(), "src/client/entries/posts.tsx"),
                post: path.resolve(process.cwd(), "src/client/entries/post.tsx"),
                texts: path.resolve(process.cwd(), "src/client/entries/texts.tsx"),
                "text-editor": path.resolve(process.cwd(), "src/client/entries/text-editor.tsx"),
                account: path.resolve(process.cwd(), "src/client/entries/account.tsx"),
                dashboard: path.resolve(process.cwd(), "src/client/entries/dashboard.tsx"),
                "dashboard-posts": path.resolve(
                    process.cwd(),
                    "src/client/entries/dashboard-posts.tsx",
                ),
                "dashboard-post": path.resolve(
                    process.cwd(),
                    "src/client/entries/dashboard-post.tsx",
                ),
                "post-editor": path.resolve(process.cwd(), "src/client/entries/post-editor.tsx"),
                settings: path.resolve(process.cwd(), "src/client/entries/settings.tsx"),
                taxonomy: path.resolve(process.cwd(), "src/client/entries/taxonomy.tsx"),
                profile: path.resolve(process.cwd(), "src/client/entries/profile.tsx"),
                legacy: path.resolve(process.cwd(), "src/client/entries/legacy.tsx"),
                maintenance: path.resolve(process.cwd(), "src/client/entries/maintenance.tsx"),
                admin: path.resolve(process.cwd(), "src/client/entries/admin.tsx"),
                "admin-users": path.resolve(process.cwd(), "src/client/entries/admin-users.tsx"),
                "admin-posts": path.resolve(process.cwd(), "src/client/entries/admin-posts.tsx"),
                "admin-reports": path.resolve(
                    process.cwd(),
                    "src/client/entries/admin-reports.tsx",
                ),
                "admin-logs": path.resolve(process.cwd(), "src/client/entries/admin-logs.tsx"),
                "admin-settings": path.resolve(
                    process.cwd(),
                    "src/client/entries/admin-settings.tsx",
                ),
                "admin-settings": path.resolve(
                    process.cwd(), "src/client/entries/admin-settings.tsx",
                ),
                "admin-analytics": path.resolve(process.cwd(), "src/client/entries/admin-analytics.tsx"),
                faq: path.resolve(process.cwd(), "src/client/entries/faq.tsx"),
                "static-pages": path.resolve(process.cwd(), "src/client/entries/static-pages.tsx"),
                "git-commits": path.resolve(process.cwd(), "src/client/entries/git-commits.tsx"),
                error: path.resolve(process.cwd(), "src/client/entries/error.tsx"),
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
