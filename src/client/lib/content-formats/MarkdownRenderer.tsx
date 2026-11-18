import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
    content: string;
    interactive: boolean;
}

export function MarkdownRenderer({ content, interactive }: MarkdownRendererProps) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
                a: ({ href, title, children }) => {
                    if (!interactive || !href) {
                        return <>{children}</>;
                    }

                    let url: URL;

                    try {
                        url = new URL(href, window.location.origin);
                    } catch {
                        return <>{children}</>;
                    }

                    if (
                        url.protocol !== "http:" &&
                        url.protocol !== "https:" &&
                        url.protocol !== "mailto:"
                    ) {
                        return <>{children}</>;
                    }

                    const external =
                        (url.protocol === "http:" || url.protocol === "https:") &&
                        url.origin !== window.location.origin;

                    return (
                        <a
                            href={href}
                            title={title}
                            target={external ? "_blank" : undefined}
                            rel={external ? "ugc noopener noreferrer" : "ugc"}
                        >
                            {children}
                        </a>
                    );
                },
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
