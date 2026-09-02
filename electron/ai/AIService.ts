import type { LanguageModel } from 'ai';
import type { Message } from '../../src/types/chat.js';
import type { AgentsService } from '../services/AgentsService.js';
import type { ProvidersService } from '../services/ProvidersService.js';
import logService from '../LogService.js';
import { createLanguageModel } from './createLanguageModel.js';
import { mapMessages } from './mapMessages.js';
import { mapParams } from './mapParams.js';
import { redactValue, truncateDebugText } from './redact.js';
import { resolveAgentForRun } from './resolveAgentForRun.js';

export type AiSendErrorCode =
  | 'no-agent'
  | 'unbound'
  | 'missing-model'
  | 'no-api-key'
  | 'unknown_kind'
  | 'send_failed';

export type AiSendResult =
  | { streamId: string }
  | { error: { code: AiSendErrorCode; message: string } };

export type AiStreamHandlers = {
  onStreamReady?: (_streamId: string) => void;
  onToken: (_text: string) => void;
  onReasoning: (_text: string) => void;
  onSource: (_source: { url: string; title?: string }) => void;
  onDone: (_reason: 'stop' | 'aborted') => void;
  onError: (_message: string) => void;
};

export type StreamTextFn = (_opts: {
  model: LanguageModel;
  messages: unknown;
  abortSignal: AbortSignal;
  temperature: number;
  maxOutputTokens: number;
  topP: number;
}) => { fullStream: AsyncIterable<unknown> };

type InFlight = {
  streamId: string;
  controller: AbortController;
};

export class AIService {
  private inFlight: InFlight | null = null;
  private sendLog = logService.scope('ai.send');
  private streamLog = logService.scope('ai.stream');
  private abortLog = logService.scope('ai.abort');
  private readonly agentsService: AgentsService;
  private readonly providersService: ProvidersService;
  private readonly deps: {
    streamText: StreamTextFn;
    createLanguageModel: typeof createLanguageModel;
  };

  constructor(
    agentsService: AgentsService,
    providersService: ProvidersService,
    deps: {
      streamText: StreamTextFn;
      createLanguageModel: typeof createLanguageModel;
    }
  ) {
    this.agentsService = agentsService;
    this.providersService = providersService;
    this.deps = deps;
  }

  async send(
    agentId: number,
    messages: Message[],
    handlers: AiStreamHandlers
  ): Promise<AiSendResult> {
    this.abortCurrent();

    const resolved = resolveAgentForRun(
      agentId,
      await this.agentsService.list(),
      await this.providersService.list()
    );
    if (resolved.ok === false) {
      this.sendLog.info('resolve failed', redactValue({ agentId, code: resolved.code }));
      return { error: { code: resolved.code, message: resolved.message } };
    }

    const { agent, provider, model } = resolved;
    const streamId = crypto.randomUUID();
    const controller = new AbortController();
    this.inFlight = { streamId, controller };
    handlers.onStreamReady?.(streamId);

    this.sendLog.debug(
      'starting stream',
      redactValue({
        streamId,
        agentId,
        kind: provider.kind,
        modelId: model.modelId,
      })
    );

    let languageModel: LanguageModel;
    try {
      languageModel = this.deps.createLanguageModel(
        {
          kind: provider.kind,
          apiKey: provider.apiKey,
          host: provider.host ?? '',
          apiVersion: provider.apiVersion ?? null,
        },
        model.modelId
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('Unknown provider kind:')) {
        return { error: { code: 'unknown_kind', message } };
      }
      return { error: { code: 'send_failed', message } };
    }

    const mappedMessages = mapMessages(
      messages.filter((m) => m.role !== 'error'),
      agent.instructions
    );
    const params = mapParams({
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      topP: agent.topP,
      reasoning: agent.reasoning,
      webSearch: agent.webSearch,
    });

    void this.runStream(streamId, controller, handlers, () =>
      this.deps.streamText({
        model: languageModel,
        messages: mappedMessages,
        abortSignal: controller.signal,
        temperature: params.temperature,
        maxOutputTokens: params.maxOutputTokens,
        topP: params.topP,
      })
    );

    return { streamId };
  }

  abort(streamId: string): void {
    if (!this.inFlight || this.inFlight.streamId !== streamId) return;
    this.abortLog.debug('abort', { streamId });
    this.inFlight.controller.abort();
  }

  private abortCurrent(): void {
    if (!this.inFlight) return;
    this.inFlight.controller.abort();
    this.inFlight = null;
  }

  private async runStream(
    streamId: string,
    controller: AbortController,
    handlers: AiStreamHandlers,
    start: () => { fullStream: AsyncIterable<unknown> }
  ): Promise<void> {
    try {
      const { fullStream } = start();
      for await (const part of fullStream) {
        this.handleStreamPart(streamId, part, handlers);
      }
      if (!controller.signal.aborted) {
        handlers.onDone('stop');
      }
    } catch (err) {
      if (controller.signal.aborted) {
        handlers.onDone('aborted');
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      this.streamLog.error('stream failed', { streamId, message });
      handlers.onError(message);
    } finally {
      if (this.inFlight?.streamId === streamId) {
        this.inFlight = null;
      }
    }
  }

  private handleStreamPart(streamId: string, part: unknown, handlers: AiStreamHandlers): void {
    if (!part || typeof part !== 'object') return;
    const chunk = part as Record<string, unknown>;

    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
      this.streamLog.debug('token', { streamId, text: truncateDebugText(chunk.text) });
      handlers.onToken(chunk.text);
      return;
    }

    if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') {
      handlers.onReasoning(chunk.text);
      return;
    }

    if (chunk.type === 'source' && typeof chunk.url === 'string') {
      handlers.onSource({
        url: chunk.url,
        title: typeof chunk.title === 'string' ? chunk.title : undefined,
      });
    }
  }
}
