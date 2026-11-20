import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';

interface Props {
  text: string;
  muted?: boolean;
}

export default function ChatMarkdown({ text, muted = false }: Props) {
  return (
    <div className={muted ? 'text-default-500' : undefined}>
      <div className={`markdown-body ${muted ? '[color:inherit]' : ''}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
        >
          {text}
        </ReactMarkdown>
      </div>
    </div>
  );
}
