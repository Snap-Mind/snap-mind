import { Accordion, AccordionItem } from '@heroui/react';

import Icon from './Icon';
import { Message } from '@/types/chat';
import { getTextContent } from '@/utils/messageContent';

interface ErrorMessageProps {
  message: Message;
}

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
              title={<span className="text-sm font-medium text-danger">{headline}</span>}
              indicator={<Icon icon="circle-x" className="text-danger" size={16} />}
              classNames={{
                content: 'pt-0 pb-2',
              }}
            >
              <pre className="whitespace-pre-wrap text-sm text-default-600 font-sans m-0">
                {detail}
              </pre>
            </AccordionItem>
          </Accordion>
        ) : (
          <div className="flex flex-row items-center gap-2 py-2">
            <Icon icon="circle-x" className="text-danger" size={16} />
            <span className="text-sm font-medium text-danger">{headline}</span>
          </div>
        )}
      </div>
    </div>
  );
}
