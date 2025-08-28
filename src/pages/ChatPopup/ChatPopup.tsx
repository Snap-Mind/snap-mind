import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Select, SelectSection, SelectItem, Textarea } from '@heroui/react';

import { useSettings } from '../../hooks/useSettings';

import { AIService } from '../../services/AIService';
import loggerService from '../../services/LoggerService';
import ChatMessage from '../ChatMessage/ChatMessage';

import { Message } from '@/types/chat';
import { useTranslation } from 'react-i18next';

interface ChatPopupProps {
  initialMessage?: Message | Message[];
}

export default function ChatPopup({ initialMessage }: ChatPopupProps) {
  const {t} = useTranslation();
  const [messages, setMessages] = useState<Message[]>(() =>
    Array.isArray(initialMessage) ? initialMessage : initialMessage ? [initialMessage] : []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { settings, setSettings } = useSettings();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Helper function to handle sending messages to AI and processing responses
  const processAIMessage = useCallback(
    async (messagesToSend: Message[]) => {
      setLoading(true);

      // Add an empty assistant message that will be filled with streaming content
      setMessages((msgs) => [...msgs, { role: 'assistant', content: '' }]);

      try {
        const aiService = new AIService(settings);
        // Use the streaming capability with onToken callback
        await aiService.sendMessageToAI(messagesToSend, (token) => {
          // Update the last message (assistant) with the new token
          setMessages((currentMsgs) => {
            const updatedMsgs = [...currentMsgs];
            const lastIndex = updatedMsgs.length - 1;

            if (lastIndex >= 0 && updatedMsgs[lastIndex].role === 'assistant') {
              updatedMsgs[lastIndex] = {
                ...updatedMsgs[lastIndex],
                content: updatedMsgs[lastIndex].content + token,
              };
            }

            return updatedMsgs;
          });
        });
      } catch (error) {
        loggerService.error(`[renderer] ${this.providerConfig.id} error:`, error);
        setMessages((msgs) => [
          ...msgs.slice(0, -1), // Remove the streaming message
          { role: 'assistant', content: 'Error: Unable to get response.' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [settings]
  );

  useEffect(() => {
    if (
      window.electronAPI &&
      window.electronAPI.chatPopupReady &&
      window.electronAPI.onInitMessage
    ) {
      window.electronAPI.chatPopupReady();
      window.electronAPI.onInitMessage((msgArr) => {
        // msgArr is expected to be an array of messages
        const initialMessages = Array.isArray(msgArr) ? msgArr : [msgArr];
        setMessages((prev) => (prev.length === 0 ? initialMessages : prev));

        // Process the initial message with AI
        processAIMessage(initialMessages);
      });
    }
  }, [processAIMessage]);

  useEffect(() => {
    window.addEventListener('keydown', handleEscapeKey);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const renderAvailableModels = () => {
    return settings.providers
      .filter((provider) => provider.apiKey && provider.host && provider.models.length !== 0)
      .map((provider) => (
        <SelectSection key={provider.name} title={provider.name}>
          {provider.models.map((model) => (
            <SelectItem key={model.id} title={model.id}>
              {model.id}
            </SelectItem>
          ))}
        </SelectSection>
      ));
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };

    // First update state to add user message
    setInput('');
    setMessages((msgs) => [...msgs, userMsg]);

    // Then call AI with the updated conversation history
    const newMsgs = [...messages, userMsg];
    await processAIMessage(newMsgs);
  };

  const handleKeyDown = (e) => {
    if (e.isComposing || e.keyCode === 229) {
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEscapeKey = (event) => {
    if (event.key === 'Escape') {
      if (window.electronAPI && window.electronAPI.closeChatPopup) {
        window.electronAPI.closeChatPopup();
      }
    }
  };

  const handleModelChange = (e) => {
    setSettings(['chat', 'defaultModel'], e.target.value);
  };

  // // Set window title
  // useEffect(() => {
  //   setWindowTitle(WINDOW_TITLES.CHAT);
  // }, []);

  return (
    <div className="w-full h-full">
      <AnimatePresence>
        <motion.div
          className="bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
        >
          <motion.div
            className="bg-background w-full h-screen shadow-2xl flex flex-col overflow-hidden"
            initial={{ scale: 0.8, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            aria-label="Chat conversation"
          >
            <div
              className="flex-1 overflow-y-auto p-[18px_14px_8px_14px] bg-background flex flex-col gap-2.5"
              aria-label="Chat messages"
            >
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
              {loading && <ChatMessage message={{ role: 'assistant', content: '...' }} />}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-end p-3 bg-background gap-2 shadow-medium mb-3 rounded-2xl w-[calc(100%-var(--spacing)*6)] m-[0_auto]">
              <Textarea
                className="flex-1"
                aria-label="Message input"
                placeholder={t('chat.sendMessage')}
                value={input}
                minRows={1}
                maxRows={5}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="basis-[200px] flex flex-row items-center gap-2">
                <Select
                  className="flex-1 max-w-xs"
                  size="md"
                  placeholder="model"
                  aria-label="Select AI model"
                  selectionMode="single"
                  disallowEmptySelection={true}
                  defaultSelectedKeys={[settings.chat.defaultModel]}
                  onChange={handleModelChange}
                  popoverProps={{
                    classNames: {
                      content: 'w-[210px]',
                    },
                  }}
                >
                  {renderAvailableModels()}
                </Select>

                <Button
                  className="bg-foreground text-default"
                  color="primary"
                  onPress={handleSend}
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                >
                  {t('chat.send')}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
