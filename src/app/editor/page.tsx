// src/app/editor/page.tsx
import { FlowEditor } from "@/components/editor/flow-editor";

export default function EditorPage() {
  return (
    <div className="h-screen w-full bg-gray-900">
      <FlowEditor />
    </div>
  );
}