import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { PostPage } from "../components/PostPage";

const postId = decodeURIComponent(location.pathname.replace(/^\/posts\//, "").replace(/\/$/, ""));
const root = document.querySelector("#post");

if (root)
    createRoot(root).render(
        <App>
            <PostPage postId={postId} />
        </App>,
    );
