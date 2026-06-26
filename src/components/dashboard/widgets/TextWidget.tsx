import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useDashboardStore } from '@/store/dashboard-store';
import { useEffect } from 'react';

export default function TextWidget({ widgetId, slideId }: { widgetId: string, slideId: string }) {
  const store = useDashboardStore();
  const widget = store.slides.find(s => s.id === slideId)?.widgets[widgetId];
  const variables = store.variables;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Type your narrative here. Use {{VariableName}} to insert dynamic data...',
      }),
    ],
    content: widget?.content || '',
    onUpdate: ({ editor }) => {
      store.updateWidget(slideId, widgetId, { content: editor.getHTML() });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-slate max-w-none focus:outline-none min-h-[100px]',
      },
    },
  });

  // Re-render text when variables change (simple replace for MVP)
  // In a real app we might want a custom TipTap node for variables.
  // For now, we'll just parse the HTML when displaying, or let the user see raw {{var}} while editing
  // and replace it in the PPTX export.
  
  if (!widget) return null;

  return (
    <div className="h-full w-full overflow-y-auto cursor-text px-1" onMouseDown={(e) => e.stopPropagation()}>
      <EditorContent editor={editor} />
      
      {/* Live Preview Bar (shows parsed variables) */}
      <div className="mt-4 pt-2 border-t border-slate-100">
        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">Live Preview</p>
        <div 
          className="text-xs text-slate-600 prose prose-xs"
          dangerouslySetInnerHTML={{ 
            __html: (widget.content || '').replace(/\{\{([^}]+)\}\}/g, (match, key) => {
              const val = variables[key.trim()];
              return val !== undefined 
                ? `<span class="bg-blue-100 text-blue-800 font-medium px-1 rounded">${val}</span>` 
                : `<span class="bg-red-100 text-red-800 font-medium px-1 rounded">${match} (not found)</span>`;
            })
          }}
        />
      </div>
    </div>
  );
}
