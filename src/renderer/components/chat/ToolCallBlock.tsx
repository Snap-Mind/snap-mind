import type { ToolPart } from '@/types/chat';

interface Props {
  part: ToolPart;
}

export default function ToolCallBlock({ part }: Props) {
  const renderOutput = () => {
    if (part.state === 'output-error') {
      return <p className="text-danger text-xs mt-1">{String(part.output)}</p>;
    }
    if (part.state === 'output-available' && part.output !== undefined) {
      if (typeof part.output === 'string') {
        return <p className="text-xs mt-1 text-default-600">{part.output}</p>;
      }
      return (
        <pre className="text-xs mt-1 text-default-600 whitespace-pre-wrap break-all">
          {JSON.stringify(part.output, null, 2)}
        </pre>
      );
    }
    return null;
  };

  return (
    <div className="rounded-md border border-default-200 bg-default-50 px-3 py-2 text-xs">
      <span className="font-mono font-medium">{part.toolName}</span>
      <span className="ml-2 text-default-400">{part.state}</span>
      {renderOutput()}
    </div>
  );
}
