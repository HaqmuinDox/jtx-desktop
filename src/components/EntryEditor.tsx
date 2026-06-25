import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect } from 'react'

interface EntryEditorProps {
    content:   string
    onChange:  (markdown: string) => void
    readOnly?: boolean
}

export function EntryEditor({ content, onChange, readOnly = false }: EntryEditorProps) {
    const editor = useEditor({
        extensions: [StarterKit],
        content:    markdownToHtml(content),
        editable:   !readOnly,
        onUpdate:   ({ editor }) => {
            onChange(htmlToMarkdown(editor.getHTML()))
        },
    })

    // Update content when entry changes
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            const current = htmlToMarkdown(editor.getHTML())
            if (current !== content) {
                editor.commands.setContent(markdownToHtml(content), { emitUpdate: false })
            }
        }
    }, [content, editor])

    return (
        <div style={{
            flex:        1,
            overflowY:   'auto',
            cursor:      readOnly ? 'default' : 'text',
        }}>
            <style>{`
        .ProseMirror {
          outline: none;
          font-family: var(--font-ui);
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.7;
          min-height: 120px;
          padding: 4px 0;
        }
        .ProseMirror p { margin-bottom: 0.7em; }
        .ProseMirror p:last-child { margin-bottom: 0; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.4em; margin-bottom: 0.7em; }
        .ProseMirror li { margin-bottom: 0.2em; }
        .ProseMirror h1 { font-family: var(--font-display); font-size: 18px; font-weight: 400; color: var(--text-primary); margin: 0.8em 0 0.3em; }
        .ProseMirror h2 { font-family: var(--font-display); font-size: 15px; font-weight: 400; color: var(--text-primary); margin: 0.8em 0 0.3em; }
        .ProseMirror h3 { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 0.8em 0 0.3em; }
        .ProseMirror strong { color: var(--text-primary); font-weight: 600; }
        .ProseMirror em { font-style: italic; }
        .ProseMirror code { font-family: monospace; font-size: 12px; background: var(--bg-raised); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; color: var(--accent); }
        .ProseMirror pre { background: var(--bg-raised); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 0.7em; }
        .ProseMirror pre code { background: none; border: none; padding: 0; color: var(--text-secondary); }
        .ProseMirror blockquote { border-left: 3px solid var(--accent-dim); margin: 0 0 0.7em; padding: 4px 0 4px 14px; color: var(--text-muted); font-style: italic; }
        .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; float: left; height: 0; }
      `}</style>
            <EditorContent editor={editor} />
        </div>
    )
}

// ── Simple Markdown ↔ HTML converters ─────────────────────────────────────────
// TipTap works with HTML internally. We convert to/from Markdown for storage
// so the iCal DESCRIPTION field stays as plain Markdown (jtx Board compatible).

function applyInline(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>')
        .replace(/`(.+?)`/g,       '<code>$1</code>')
}

function markdownToHtml(md: string): string {
    if (!md) return '<p></p>'
    return md
        .split('\n\n')
        .map(block => {
            if (block.startsWith('# '))    return `<h1>${applyInline(block.slice(2))}</h1>`
            if (block.startsWith('## '))   return `<h2>${applyInline(block.slice(3))}</h2>`
            if (block.startsWith('### '))  return `<h3>${applyInline(block.slice(4))}</h3>`
            if (block.startsWith('> '))    return `<blockquote><p>${applyInline(block.slice(2))}</p></blockquote>`
            if (block.match(/^[-*] /m)) {
                const items = block
                    .split('\n')
                    .filter(l => l.trim())
                    .map(l => `<li><p>${applyInline(l.replace(/^[-*] /, ''))}</p></li>`)
                    .join('')
                return `<ul>${items}</ul>`
            }
            if (block.match(/^\d+\. /m)) {
                const items = block
                    .split('\n')
                    .filter(l => l.trim())
                    .map(l => `<li><p>${applyInline(l.replace(/^\d+\. /, ''))}</p></li>`)
                    .join('')
                return `<ol>${items}</ol>`
            }
            return `<p>${applyInline(block).split('\n').join('<br>')}</p>`
        })
        .join('')
}

function htmlToMarkdown(html: string): string {
    return html
        .replace(/<h1>(.*?)<\/h1>/g,       '# $1\n\n')
        .replace(/<h2>(.*?)<\/h2>/g,       '## $1\n\n')
        .replace(/<h3>(.*?)<\/h3>/g,       '### $1\n\n')
        .replace(/<blockquote><p>(.*?)<\/p><\/blockquote>/g, '> $1\n\n')
        .replace(/<ul>(.*?)<\/ul>/gs,      (_m, inner) =>
            inner.replace(/<li><p>(.*?)<\/p><\/li>/g, '- $1\n') + '\n'
        )
        .replace(/<ol>(.*?)<\/ol>/gs,      (_m, inner) => {
            let i = 1
            return inner.replace(/<li><p>(.*?)<\/p><\/li>/g,
                (_m2: string, t: string) => `${i++}. ${t}\n`) + '\n'
        })
        .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
        .replace(/<em>(.*?)<\/em>/g,        '*$1*')
        .replace(/<code>(.*?)<\/code>/g,    '`$1`')
        .replace(/<br\s*\/?>/g,             '\n')
        .replace(/<p>(.*?)<\/p>/g,          '$1\n\n')
        .replace(/<[^>]+>/g,                '')
        .replace(/\n{3,}/g,                 '\n\n')
        .trim()
}