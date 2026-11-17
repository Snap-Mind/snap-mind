import type { ToolPart } from '@/types/chat';
import ToolApprovalCard from './ToolApprovalCard';
import SubRunBlock from './SubRunBlock';
import ToolCallBlock from './ToolCallBlock';

interface Props {
  parts: ToolPart[];
}

export default function ToolParts({ parts }: Props) {
  return (
    <div className="flex flex-col gap-1 mt-2">
      {parts.map((part) => {
        if (part.state === 'approval-requested') {
          return <ToolApprovalCard key={part.toolCallId} part={part} />;
        }
        if (part.toolName === 'invoke_agent' && part.subRun) {
          return <SubRunBlock key={part.toolCallId} part={part} />;
        }
        return <ToolCallBlock key={part.toolCallId} part={part} />;
      })}
    </div>
  );
}
