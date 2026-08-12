import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Button, Divider, Select, SelectSection, SelectItem, Textarea } from '@heroui/react';

import { useSettingsStore } from '@/stores/useSettingsStore';
import { useChatStore } from '@/stores/useChatStore';

import ChatMessage from '../ChatMessage/ChatMessage';

import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import LogoSvg from '@/components/LogoSvg';
import ReasoningToggle from '@/components/ReasoningToggle';
import WebSearchToggle from '@/components/WebSearchToggle';
import { BaseProviderConfig, ProviderType } from '@/types/providers';

export default function ChatPopup() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const messages = useChatStore((s) => s.messages);
  const input = useChatStore((s) => s.input);
  const loading = useChatStore((s) => s.loading);
  const images = useChatStore((s) => s.images);
  const autoScroll = useChatStore((s) => s.autoScroll);
  const reasoningEnabled = useChatStore((s) => s.reasoningEnabled);
  const webSearchEnabled = useChatStore((s) => s.webSearchEnabled);
  const currentProviderId = useChatStore((s) => s.currentProviderId);
  const currentModelId = useChatStore((s) => s.currentModelId);

  const setInput = useChatStore((s) => s.setInput);
  const setAutoScroll = useChatStore((s) => s.setAutoScroll);
  const setReasoning = useChatStore((s) => s.setReasoning);
  const setWebSearch = useChatStore((s) => s.setWebSearch);
  const setModel = useChatStore((s) => s.setModel);
  const addImages = useChatStore((s) => s.addImages);
  const removeImage = useChatStore((s) => s.removeImage);
  const send = useChatStore((s) => s.send);
  const abort = useChatStore((s) => s.abort);

  const settings = useSettingsStore((s) => s.settings);
  const providers = settings?.providers ?? [];

  const hasUsableProvider = providers.some(
    (p) =>
      (p.apiKey && p.host && (p.models?.length ?? 0) > 0) ||
      (p.id === 'ollama' && p.host && (p.models?.length ?? 0) > 0) ||
      (p.id === 'foundry' && p.host && (p.models?.length ?? 0) > 0)
  );

  const isEmpty = messages.length === 0;

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI?.window?.hide?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (autoScroll) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, autoScroll]);

  const buildModelKey = (providerId: string, modelId: string) => `${providerId}::${modelId}`;
  const parseModelKey = (value: string) => {
    const [providerId, ...rest] = value.split('::');
    return { providerId, modelId: rest.join('::') };
  };

  const findProviderByModelId = (modelId: string) =>
    providers.find((p) => p.models?.some((m) => m.id === modelId));

  const selectedModelKey = (() => {
    if (currentProviderId && currentModelId)
      return buildModelKey(currentProviderId, currentModelId);
    if (currentModelId) {
      const p = findProviderByModelId(currentModelId);
      if (p) return buildModelKey(p.id, currentModelId);
    }
    return undefined;
  })();

  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const current = el.scrollTop;
    const last = lastScrollTopRef.current;
    const atBottom = el.scrollHeight - current - el.clientHeight <= 8;
    if (current < last) {
      if (autoScroll) setAutoScroll(false);
    } else if (current > last) {
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
    return providers
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

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void addImages(files);
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
      void addImages(Array.from(e.dataTransfer.files));
    },
    [addImages]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      void addImages(Array.from(e.target.files || []));
      e.target.value = '';
    },
    [addImages]
  );

  const handleSend = () => void send();
  const handleKeyDown = (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = (e.target as HTMLSelectElement).value;
    if (!value) return;
    const { providerId, modelId } = parseModelKey(value);
    setModel(providerId, modelId);
  };

  const streamingMessageIndex =
    loading && messages.at(-1)?.role === 'assistant' ? messages.length - 1 : -1;

  return (
    <div className="w-full h-full">
      <div
        className="bg-background w-full h-screen shadow-2xl flex flex-col overflow-hidden"
        aria-label="Chat conversation"
      >
            <div className="px-3 pt-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <LogoSvg className="w-8 h-8 shrink-0 ml-1" />
                  <h1 className="font-bold text-2xl leading-none tracking-tight whitespace-nowrap">
                    {t('common.brand')}
                  </h1>
                </div>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => navigate('/settings/general')}
                  aria-label="Open settings"
                >
                  <Icon icon="settings" size={16} />
                </Button>
              </div>
              <Divider className="my-4" />
            </div>
            <div
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto p-[18px_14px_8px_14px] bg-background flex flex-col gap-2.5"
              aria-label="Chat messages"
            >
              {isEmpty && !hasUsableProvider ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-6">
                  <p className="text-default-500">No provider configured yet.</p>
                  <Button size="sm" color="primary" onPress={() => navigate('/settings/models')}>
                    Open Settings
                  </Button>
                  <p className="text-default-400 text-xs">
                    Add a model, then hit a hotkey or type below.
                  </p>
                </div>
              ) : null}
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} isStreaming={i === streamingMessageIndex} />
              ))}
              {loading && (
                <ChatMessage message={{ role: 'assistant', content: '...' }} isStreaming />
              )}
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
                  onValueChange={setWebSearch}
                />
                <ReasoningToggle
                  aria-label={t('settings.chat.reasoning')}
                  isSelected={reasoningEnabled}
                  onValueChange={setReasoning}
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
                  <Button isIconOnly color="danger" onPress={abort} aria-label="Stop response">
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
      </div>
    </div>
  );
}
