import { createRoot } from "react-dom/client";
import { App } from "../components/App";
import { PostPage } from "../components/PostPage";

const segments = location.pathname.split("/").filter(Boolean);
const isPostsPath = segments[0] === "posts";
const identifier = decodeURIComponent(segments.at(-1) ?? "");
const postId = isPostsPath ? identifier : undefined;
const permalinkKey = isPostsPath ? undefined : identifier;
const root = document.querySelector("#post");

if (root)
    createRoot(root).render(
        <App>
            <PostPage postId={postId} permalinkKey={permalinkKey} />
        </App>,
    );
