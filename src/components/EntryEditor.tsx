import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState } from 'react'

interface EntryEditorProps {
    content:   string
    onChange:  (markdown: string) => void
    readOnly?: boolean
}

function btnStyle(active: boolean) {
    return {
        background:   active ? 'var(--bg-active)' : 'transparent',
        border:       'none',
        color:        active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize:     '12px',
        fontFamily:   'var(--font-ui)',
        padding:      '3px 7px',
        borderRadius: 'var(--radius-sm)',
        cursor:       'pointer' as const,
    }
}

export function EntryEditor({ content, onChange, readOnly = false }: EntryEditorProps) {
    const [wordCount, setWordCount] = useState(0)

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: 'Start writing…' }),
        ],
        content:  markdownToHtml(content),
        editable: !readOnly,
        onUpdate: ({ editor }) => {
            onChange(htmlToMarkdown(editor.getHTML()))
            setWordCount(editor.getText().split(/\s+/).filter(w => w.length > 0).length)
        },
    })

    // Update content and word count when entry changes
    useEffect(() => {
        if (!editor || editor.isDestroyed) return
        const current = htmlToMarkdown(editor.getHTML())
        if (current !== content) {
            editor.commands.setContent(markdownToHtml(content), { emitUpdate: false })
        }
        setWordCount(editor.getText().split(/\s+/).filter(w => w.length > 0).length)
    }, [content, editor])

    const readingTime = Math.ceil(wordCount / 200)

    return (
        <div style={{
            flex:      1,
            overflowY: 'auto',
            cursor:    readOnly ? 'default' : 'text',
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
            {editor && !readOnly && (
                <BubbleMenu editor={editor}>
                    <div style={{
                        display:      'flex',
                        alignItems:   'center',
                        background:   'var(--bg-raised)',
                        border:       '1px solid var(--border-strong)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow:    '0 4px 12px rgba(0,0,0,0.5)',
                        padding:      '4px',
                        gap:          '2px',
                    }}>
                        <button
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            style={btnStyle(editor.isActive('bold'))}
                        >
                            B
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            style={btnStyle(editor.isActive('italic'))}
                        >
                            I
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                            style={btnStyle(editor.isActive('heading', { level: 2 }))}
                        >
                            H2
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                            style={btnStyle(editor.isActive('heading', { level: 3 }))}
                        >
                            H3
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            style={btnStyle(editor.isActive('bulletList'))}
                        >
                            •
                        </button>
                        <button
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            style={btnStyle(editor.isActive('orderedList'))}
                        >
                            1.
                        </button>
                    </div>
                </BubbleMenu>
            )}
            <EditorContent editor={editor} />
            {wordCount > 0 && (
                <div style={{
                    fontSize:   '12px',
                    color:      'var(--text-muted)',
                    textAlign:  'right',
                    marginTop:  '6px',
                    paddingTop: '4px',
                    borderTop:  '1px solid var(--border)',
                }}>
                    {wordCount >= 200
                        ? `${wordCount} words · ~${readingTime} min read`
                        : `${wordCount} words`}
                </div>
            )}
        </div>
    )
}

// ── Simple Markdown ↔ HTML converters ─────────────────────────────────────────
// TipTap works with HTML internally. We convert to/from Markdown for storage
// so the iCal DESCRIPTION field stays as plain Markdown (jtx Board compatible).

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

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
            if (block.startsWith('# '))    return `<h1>${applyInline(escapeHtml(block.slice(2)))}</h1>`
            if (block.startsWith('## '))   return `<h2>${applyInline(escapeHtml(block.slice(3)))}</h2>`
            if (block.startsWith('### '))  return `<h3>${applyInline(escapeHtml(block.slice(4)))}</h3>`
            if (block.startsWith('> '))    return `<blockquote><p>${applyInline(escapeHtml(block.slice(2)))}</p></blockquote>`
            if (block.match(/^[-*] /m)) {
                const items = block
                    .split('\n')
                    .filter(l => l.trim())
                    .map(l => `<li><p>${applyInline(escapeHtml(l.replace(/^[-*] /, '')))}</p></li>`)
                    .join('')
                return `<ul>${items}</ul>`
            }
            if (block.match(/^\d+\. /m)) {
                const items = block
                    .split('\n')
                    .filter(l => l.trim())
                    .map(l => `<li><p>${applyInline(escapeHtml(l.replace(/^\d+\. /, '')))}</p></li>`)
                    .join('')
                return `<ol>${items}</ol>`
            }
            return `<p>${applyInline(escapeHtml(block)).split('\n').join('<br>')}</p>`
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
