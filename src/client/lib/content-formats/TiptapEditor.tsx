import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface TiptapEditorProps {
    value?: Record<string, unknown>;
    onChange: (document: Record<string, unknown>) => void;
}

export function TiptapEditor({ value, onChange }: TiptapEditorProps) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: value ?? {
            type: "doc",
            content: [{ type: "paragraph" }],
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getJSON() as Record<string, unknown>);
        },
    });

    return <EditorContent editor={editor} />;
}
