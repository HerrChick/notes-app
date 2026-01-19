import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-3 text-sm text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-primary-400">{children}</h3>,
          a: ({ children, ...props }) => (
            <a {...props} className="text-primary-400 hover:underline">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-text">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg border border-border bg-surface p-3 text-xs">{children}</pre>
          ),
          li: ({ children }) => <li className="ml-5 list-disc">{children}</li>,
          p: ({ children }) => <p className="leading-relaxed text-muted">{children}</p>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

