import React, { useLayoutEffect, useMemo, useRef } from "react";
import ReactQuill from "react-quill";
// The app runs Quill 2 (package.json "overrides"), so it needs Quill 2's stylesheet. react-quill's bundled
// quill.snow.css is Quill 1's: it numbers every <ol> item, and Quill 2 stores bullet lists as <ol><li data-list="bullet">.
import "quill/dist/quill.snow.css";
import "./rich-text-editor.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Write your note content...",
}) => {
  const ref = useRef<ReactQuill>(null);
  // The HTML the editor last produced or loaded; anything else arriving in `value` is loaded into the editor.
  const current = useRef<string | null>(null);
  const loading = useRef(false);

  // react-quill 2.0 loads a `value` with Quill 1's clipboard.convert(html). Quill 2 expects convert({ html }) and
  // returns an empty document for a plain string, so saved notes opened blank. Load the HTML the Quill 2 way instead.
  useLayoutEffect(() => {
    const quill = ref.current?.getEditor();
    if (!quill || value === current.current) return;
    // Quill 2 still reports a change while it lays out the loaded document; that is not an edit.
    loading.current = true;
    try {
      quill.setContents(quill.clipboard.convert({ html: value || "" }), "silent");
      quill.update("silent");
    } finally {
      loading.current = false;
    }
    current.current = value;
  }, [value]);

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
        [{ align: [] }],
        ["link", "code-block"],
        [{ color: [] }, { background: [] }],
        ["clean"],
      ],
    }),
    []
  );

  // Quill 2 format names. "indent" keeps nested list levels (Tab / Shift+Tab and the toolbar buttons).
  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "indent",
    "align",
    "link",
    "code-block",
    "color",
    "background",
  ];

  return (
    <div className="rich-text-editor-wrapper">
      <ReactQuill
        ref={ref}
        theme="snow"
        onChange={(html) => {
          if (loading.current) return;
          current.current = html;
          onChange(html);
        }}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="bg-background"
      />
    </div>
  );
};
