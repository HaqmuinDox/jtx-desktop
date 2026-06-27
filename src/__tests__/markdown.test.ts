import { describe, test, expect } from 'vitest'
import { markdownToHtml, htmlToMarkdown } from '../utils/markdown'

describe('markdownToHtml', () => {
    test('empty string returns empty paragraph', () => {
        expect(markdownToHtml('')).toBe('<p></p>')
    })

    test('plain text becomes a paragraph', () => {
        expect(markdownToHtml('Hello world')).toBe('<p>Hello world</p>')
    })

    test('# heading becomes h1', () => {
        expect(markdownToHtml('# My Title')).toBe('<h1>My Title</h1>')
    })

    test('## heading becomes h2', () => {
        expect(markdownToHtml('## Subtitle')).toBe('<h2>Subtitle</h2>')
    })

    test('### heading becomes h3', () => {
        expect(markdownToHtml('### Section')).toBe('<h3>Section</h3>')
    })

    test('> blockquote becomes blockquote element', () => {
        expect(markdownToHtml('> A quote')).toBe('<blockquote><p>A quote</p></blockquote>')
    })

    test('- list items become ul', () => {
        expect(markdownToHtml('- Apple\n- Banana'))
            .toBe('<ul><li><p>Apple</p></li><li><p>Banana</p></li></ul>')
    })

    test('* list items also become ul', () => {
        expect(markdownToHtml('* Apple\n* Banana'))
            .toBe('<ul><li><p>Apple</p></li><li><p>Banana</p></li></ul>')
    })

    test('numbered list items become ol', () => {
        expect(markdownToHtml('1. First\n2. Second'))
            .toBe('<ol><li><p>First</p></li><li><p>Second</p></li></ol>')
    })

    test('**bold** becomes <strong>', () => {
        expect(markdownToHtml('**bold text**')).toBe('<p><strong>bold text</strong></p>')
    })

    test('*italic* becomes <em>', () => {
        expect(markdownToHtml('*italic*')).toBe('<p><em>italic</em></p>')
    })

    test('`code` becomes <code>', () => {
        expect(markdownToHtml('`some code`')).toBe('<p><code>some code</code></p>')
    })

    test('HTML entities are escaped to prevent injection', () => {
        const result = markdownToHtml('<script>alert("xss")</script>')
        expect(result).not.toContain('<script>')
        expect(result).toContain('&lt;script&gt;')
    })

    test('multiple paragraphs separated by blank lines', () => {
        const html = markdownToHtml('First\n\nSecond')
        expect(html).toContain('<p>First</p>')
        expect(html).toContain('<p>Second</p>')
    })
})

describe('htmlToMarkdown', () => {
    test('h1 becomes # heading', () => {
        expect(htmlToMarkdown('<h1>My Title</h1>')).toBe('# My Title')
    })

    test('h2 becomes ## heading', () => {
        expect(htmlToMarkdown('<h2>Subtitle</h2>')).toBe('## Subtitle')
    })

    test('h3 becomes ### heading', () => {
        expect(htmlToMarkdown('<h3>Section</h3>')).toBe('### Section')
    })

    test('blockquote becomes > syntax', () => {
        expect(htmlToMarkdown('<blockquote><p>A quote</p></blockquote>')).toBe('> A quote')
    })

    test('ul becomes bullet list', () => {
        const md = htmlToMarkdown('<ul><li><p>Apple</p></li><li><p>Banana</p></li></ul>')
        expect(md).toContain('- Apple')
        expect(md).toContain('- Banana')
    })

    test('ol becomes numbered list', () => {
        const md = htmlToMarkdown('<ol><li><p>First</p></li><li><p>Second</p></li></ol>')
        expect(md).toContain('1. First')
        expect(md).toContain('2. Second')
    })

    test('<strong> becomes **bold**', () => {
        expect(htmlToMarkdown('<strong>bold</strong>')).toBe('**bold**')
    })

    test('<em> becomes *italic*', () => {
        expect(htmlToMarkdown('<em>italic</em>')).toBe('*italic*')
    })

    test('<code> becomes backtick', () => {
        expect(htmlToMarkdown('<code>code</code>')).toBe('`code`')
    })

    test('<p> content is unwrapped', () => {
        expect(htmlToMarkdown('<p>Hello</p>')).toBe('Hello')
    })

    test('<br> becomes newline', () => {
        expect(htmlToMarkdown('<p>line one<br>line two</p>')).toBe('line one\nline two')
    })
})
