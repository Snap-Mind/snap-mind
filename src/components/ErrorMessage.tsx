import { Accordion, AccordionItem } from '@heroui/react';

import Icon from './Icon';
import { Message } from '@/types/chat';
import { getTextContent } from '@/utils/messageContent';

interface ErrorMessageProps {
  message: Message;
}

// 1lh is the inherited line-height, so the icon stays centered on the first
// line of the headline at whatever font size the surrounding text uses.
const ICON_BOX = 'flex h-[1lh] shrink-0 items-center';
const HEADLINE_TEXT = 'text-sm font-medium text-danger';

export default function ErrorMessage({ message }: ErrorMessageProps) {
  const headline = getTextContent(message.content);
  const detail = message.detail;

  return (
    <div className="flex flex-row mb-0.5 justify-start" aria-label="Error message">
      <div className="w-full">
        {detail ? (
          <Accordion className="px-0">
            <AccordionItem
              key="error"
              aria-label={headline}
              title={<span>{headline}</span>}
              indicator={
                <span className={ICON_BOX}>
                  <Icon icon="circle-x" className="text-danger" size={16} />
                </span>
              }
              classNames={{
                trigger: `items-start ${HEADLINE_TEXT}`,
                content: 'pt-0 pb-2',
              }}
            >
              <pre className="whitespace-pre-wrap text-sm text-default-600 font-sans m-0">
                {detail}
              </pre>
            </AccordionItem>
          </Accordion>
        ) : (
          <div className={`flex flex-row items-start gap-2 py-2 ${HEADLINE_TEXT}`}>
            <span className={ICON_BOX}>
              <Icon icon="circle-x" className="text-danger" size={16} />
            </span>
            <span>{headline}</span>
          </div>
        )}
      </div>
    </div>
  );
}
