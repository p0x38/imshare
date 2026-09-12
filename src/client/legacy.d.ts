declare module "/posts/post-page.js" {
    export function mountPostPage(root: Element | null, postId: string): Promise<void>;
}
