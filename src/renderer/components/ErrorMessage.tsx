import { useId, useState } from 'react';

import Icon from './Icon';
import { Message } from '@/types/chat';
import { getTextContent } from '@/utils/messageContent';

interface ErrorMessageProps {
  message: Message;
}

// 1lh is the inherited line-height, so the icon stays centered on the first
// line of the headline at whatever font size the surrounding text uses.
const ICON_BOX = 'flex h-[1lh] shrink-0 items-center';
const HEADLINE = 'flex w-full flex-row items-start gap-2 py-2 text-left text-sm font-medium';

export default function ErrorMessage({ message }: ErrorMessageProps) {
  const headline = getTextContent(message.content);
  const detail = message.detail;
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();

  return (
    <div className="flex flex-row mb-0.5 justify-start" aria-label="Error message">
      <div className="w-full">
        {detail ? (
          <>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={detailId}
              onClick={() => setExpanded((value) => !value)}
              className={`${HEADLINE} transition-colors text-danger hover:cursor-pointer`}
            >
              <span className={ICON_BOX}>
                <Icon icon="circle-x" size={16} />
              </span>
              <span>{headline}</span>
            </button>
            {expanded && (
              <pre
                id={detailId}
                className="whitespace-pre-wrap text-sm text-default-600 font-sans m-0 pb-2"
              >
                {detail}
              </pre>
            )}
          </>
        ) : (
          <div className={`${HEADLINE} text-danger`}>
            <span className={ICON_BOX}>
              <Icon icon="circle-x" size={16} />
            </span>
            <span>{headline}</span>
          </div>
        )}
      </div>
    </div>
  );
}
