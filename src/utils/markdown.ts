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

export function markdownToHtml(md: string): string {
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

export function htmlToMarkdown(html: string): string {
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
