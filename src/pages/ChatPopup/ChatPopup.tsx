import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Select, SelectSection, SelectItem, Textarea } from '@heroui/react';

import { useSettings } from '../../hooks/useSettings';

import { AIService } from '../../services/AIService';
import ChatMessage from '../ChatMessage/ChatMessage';

import { Message, ChatSource, ContentPart } from '@/types/chat';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import ReasoningToggle from '@/components/ReasoningToggle';
import WebSearchToggle from '@/components/WebSearchToggle';
import { BaseProviderConfig, ProviderType } from '@/types/providers';

interface ImageAttachment {
  data: string;
  mimeType: string;
  name: string;
}

function readFileAsBase64(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ data: base64, mimeType: file.type, name: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

interface ChatPopupProps {
  initialMessage?: Message | Message[];
}

const BOTTOM_SCROLL_THRESHOLD = 8;

export default function ChatPopup({ initialMessage }: ChatPopupProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>(() =>
    Array.isArray(initialMessage) ? initialMessage : initialMessage ? [initialMessage] : []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { settings, setSettings } = useSettings();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [reasoningEnabled, setReasoningEnabled] = useState(settings.chat.reasoningEnabled ?? false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(settings.chat.webSearchEnabled ?? false);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when settings change externally (e.g. from Settings page)
  useEffect(() => {
    setReasoningEnabled(settings.chat.reasoningEnabled ?? false);
    setWebSearchEnabled(settings.chat.webSearchEnabled ?? false);
  }, [settings]); // Note: using `settings` (not `settings.chat.reasoningEnabled`) as the dependency keeps settings in sync across different windows.

  // Focus the input when ChatPopup mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const buildModelKey = (providerId: string, modelId: string) => `${providerId}::${modelId}`;

  const parseModelKey = (value: string) => {
    const [providerId, ...modelParts] = value.split('::');
    return { providerId, modelId: modelParts.join('::') };
  };

  const findProviderByModelId = (modelId: string) =>
    settings.providers.find((provider) => provider.models.some((model) => model.id === modelId));

  const getSelectedModelKey = () => {
    if (settings.chat.defaultProvider && settings.chat.defaultModel) {
      return buildModelKey(settings.chat.defaultProvider, settings.chat.defaultModel);
    }

    if (settings.chat.defaultModel) {
      const provider = findProviderByModelId(settings.chat.defaultModel);
      if (provider) {
        return buildModelKey(provider.id, settings.chat.defaultModel);
      }
    }

    return undefined;
  };

  // Helper function to handle sending messages to AI and processing responses
  const processAIMessage = useCallback(
    async (messagesToSend: Message[]) => {
      setLoading(true);

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Add an empty assistant message that will be filled with streaming content
      setMessages((msgs) => [...msgs, { role: 'assistant', content: '' }]);

      try {
        const aiService = new AIService(settings);
        // Use the streaming capability with onToken callback
        await aiService.sendMessageToAI(
          messagesToSend,
          (token) => {
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
          },
          {
            signal,
            onWebSources: (sources: ChatSource[]) => {
              setMessages((currentMsgs) => {
                const updatedMsgs = [...currentMsgs];
                const lastIndex = updatedMsgs.length - 1;
                if (lastIndex >= 0 && updatedMsgs[lastIndex].role === 'assistant') {
                  updatedMsgs[lastIndex] = { ...updatedMsgs[lastIndex], sources };
                }
                return updatedMsgs;
              });
            },
          }
        );
      } catch (error) {
        if (error && error.name === 'AbortError') {
          // Keep unfinished message, add a new message for abort
          setMessages((msgs) => [...msgs, { role: 'system', content: 'Response is aborted.' }]);
        } else {
          setMessages((msgs) => [
            ...msgs.slice(0, -1), // Remove the streaming message
            { role: 'assistant', content: 'Error: Unable to get response.' },
          ]);
        }
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

  // Auto scroll only if the flag is enabled (user is at / returns to bottom)
  useEffect(() => {
    if (autoScroll) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, autoScroll]);

  // If user scrolls downward (content moving up), enable autoScroll.
  // If user scrolls upward, disable autoScroll.
  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const current = el.scrollTop;
    const last = lastScrollTopRef.current;
    const atBottom = el.scrollHeight - current - el.clientHeight <= BOTTOM_SCROLL_THRESHOLD;

    if (current < last) {
      // scrolling up -> disable auto scroll
      if (autoScroll) setAutoScroll(false);
    } else if (current > last) {
      // scrolling down -> only enable if truly at bottom
      if (!autoScroll && atBottom) setAutoScroll(true);
    }
    lastScrollTopRef.current = current;
  };

  const renderAvailableModels = () => {
    const isValidProvider = (provider: BaseProviderConfig) => {
      const ollamaType: ProviderType = 'ollama';
      const foundryType: ProviderType = 'foundry';
      return (
        (provider.apiKey && provider.host && provider.models.length !== 0) ||
        (provider.id === ollamaType && provider.host != null && provider.models.length !== 0) ||
        (provider.id === foundryType && provider.host != null && provider.models.length !== 0)
      );
    };

    return settings.providers
      .filter((provider) => isValidProvider(provider))
      .map((provider) => (
        <SelectSection key={provider.name} title={provider.name}>
          {provider.models.map((model) => (
            <SelectItem
              key={buildModelKey(provider.id, model.id)}
              textValue={model.id}
              title={model.id}
            >
              {model.id}
            </SelectItem>
          ))}
        </SelectSection>
      ));
  };

  const addImages = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length === 0) return;
    const newAttachments = await Promise.all(imageFiles.map(readFileAsBase64));
    setImages((prev) => [...prev, ...newAttachments]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    },
    [addImages]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      addImages(files);
    },
    [addImages]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      addImages(files);
      e.target.value = '';
    },
    [addImages]
  );

  const handleSend = async () => {
    if ((!input.trim() && images.length === 0) || loading) return;

    let content: string | ContentPart[];
    if (images.length > 0) {
      const parts: ContentPart[] = [];
      if (input.trim()) {
        parts.push({ type: 'text', text: input });
      }
      for (const img of images) {
        parts.push({ type: 'image', data: img.data, mimeType: img.mimeType });
      }
      content = parts;
    } else {
      content = input;
    }

    const userMsg: Message = { role: 'user', content };

    // First update state to add user message
    setInput('');
    setImages([]);
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
    const value = e.target.value;
    if (!value) return;
    const { providerId, modelId } = parseModelKey(value);
    setSettings(['chat', 'defaultProvider'], providerId);
    setSettings(['chat', 'defaultModel'], modelId);
  };

  const selectedModelKey = getSelectedModelKey();

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
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto p-[18px_14px_8px_14px] bg-background flex flex-col gap-2.5"
              aria-label="Chat messages"
            >
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
              {loading && <ChatMessage message={{ role: 'assistant', content: '...' }} />}
              <div ref={chatEndRef} />
            </div>
            <div
              className={`flex flex-col p-3 bg-default-100 gap-2 shadow-medium mb-3 rounded-2xl w-[calc(100%-var(--spacing)*6)] m-[0_auto] transition-colors ${isDragging ? 'ring-2 ring-primary bg-primary/10' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Textarea
                className="flex-1"
                classNames={{
                  inputWrapper: 'bg-default-100 shadow-none data-[hover=true]:bg-default-100',
                }}
                variant="flat"
                aria-label="Message input"
                placeholder={t('chat.sendMessage')}
                value={input}
                minRows={1}
                maxRows={5}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                ref={inputRef}
              />
              {images.length > 0 && (
                <div className="flex flex-row gap-2 overflow-x-auto p-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative flex-shrink-0 group">
                      <img
                        src={`data:${img.mimeType};base64,${img.data}`}
                        alt={img.name}
                        className="w-16 h-16 object-cover rounded-lg border border-default-200"
                      />
                      <button
                        className="absolute -top-1.5 -right-1.5 bg-danger text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(i)}
                        aria-label="Remove image"
                      >
                        <Icon icon="circle-x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex-shrink-0 flex flex-row justify-end gap-2 items-center">
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => fileInputRef.current?.click()}
                  aria-label="Attach image"
                >
                  <Icon icon="image" size={18} />
                </Button>
                <WebSearchToggle
                  aria-label={t('settings.chat.webSearch')}
                  isSelected={webSearchEnabled}
                  onValueChange={(checked) => {
                    setWebSearchEnabled(checked);
                    setSettings(['chat', 'webSearchEnabled'], checked);
                  }}
                />
                <ReasoningToggle
                  aria-label={t('settings.chat.reasoning')}
                  isSelected={reasoningEnabled}
                  onValueChange={(checked) => {
                    setReasoningEnabled(checked);
                    setSettings(['chat', 'reasoningEnabled'], checked);
                  }}
                />
                <Select
                  className="flex-1 max-w-xs"
                  size="md"
                  variant="bordered"
                  placeholder="model"
                  aria-label="Select AI model"
                  selectionMode="single"
                  disallowEmptySelection={true}
                  defaultSelectedKeys={selectedModelKey ? [selectedModelKey] : []}
                  onChange={handleModelChange}
                  popoverProps={{
                    classNames: {
                      content: 'w-[210px]',
                    },
                  }}
                >
                  {renderAvailableModels()}
                </Select>

                {loading ? (
                  <Button
                    isIconOnly
                    color="danger"
                    onPress={() => {
                      if (abortControllerRef.current) {
                        abortControllerRef.current.abort();
                      }
                    }}
                    aria-label="Stop response"
                  >
                    <Icon icon="square"></Icon>
                  </Button>
                ) : (
                  <Button
                    isIconOnly
                    color="primary"
                    onPress={handleSend}
                    disabled={loading || (!input.trim() && images.length === 0)}
                    aria-label="Send message"
                  >
                    <Icon icon="arrow-up"></Icon>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
