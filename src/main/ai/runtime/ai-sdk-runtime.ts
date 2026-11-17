import { tool, jsonSchema, isStepCount, streamText } from 'ai';
import type { ModelRuntime } from './model-runtime.js';
import type { RunEvent, StreamRequest } from './types.js';
import { mapMessages } from './map-messages.js';
import { mapReasoningLevel } from '../mapping/map-params.js';
import { describeAiError } from '../describe-ai-error.js';
import { createLanguageModel } from '../providers/create-language-model.js';

export type StreamTextLike = (_opts: Record<string, unknown>) => { stream: AsyncIterable<unknown> };

/**
 * Factory for the production AiSdkRuntime, importing the real `streamText` from `ai`.
 * Called from index.ts so that index.ts itself does not import from 'ai' directly.
 */
export function createAiSdkRuntime(): AiSdkRuntime {
  return new AiSdkRuntime({
    streamText: (opts) => streamText(opts as never) as unknown as ReturnType<StreamTextLike>,
    createLanguageModel,
  });
}

export class AiSdkRuntime implements ModelRuntime {
  private readonly streamText: StreamTextLike;
  private readonly createLanguageModel: typeof createLanguageModel;

  constructor(deps: {
    streamText: StreamTextLike;
    createLanguageModel: typeof createLanguageModel;
  }) {
    this.streamText = deps.streamText;
    this.createLanguageModel = deps.createLanguageModel;
  }

  async *stream(req: StreamRequest): AsyncIterable<RunEvent> {
    // Create the language model — if it throws, yield error and return
    let model: ReturnType<typeof createLanguageModel>;
    try {
      model = this.createLanguageModel(
        {
          kind: req.model.provider.kind,
          apiKey: req.model.provider.apiKey,
          host: req.model.provider.host,
          apiVersion: req.model.provider.apiVersion,
        },
        req.model.modelId
      );
    } catch (err) {
      yield { type: 'error', message: describeAiError(err) };
      return;
    }

    // Build streamText options
    const baseOpts: Record<string, unknown> = {
      model,
      messages: mapMessages(req.messages),
      instructions: req.instructions,
      abortSignal: req.abortSignal,
      temperature: req.params.temperature,
      maxOutputTokens: req.params.maxOutputTokens,
      topP: req.params.topP,
      reasoning: mapReasoningLevel(req.params.reasoning),
    };

    if (req.tools.length > 0) {
      // Build SDK tools record
      const sdkTools: Record<string, unknown> = {};
      for (const rt of req.tools) {
        sdkTools[rt.name] = tool({
          description: rt.description,
          inputSchema: jsonSchema(rt.inputSchema),
          execute: (input: unknown, options: { toolCallId?: string; abortSignal?: AbortSignal }) =>
            rt.execute(input, {
              toolCallId: options.toolCallId ?? '',
              abortSignal: options.abortSignal ?? req.abortSignal,
            }),
        });
      }
      baseOpts['tools'] = sdkTools;
      baseOpts['stopWhen'] = isStepCount(req.maxSteps);
      // Spec decision: one worker at a time. The SDK default is unlimited concurrency.
      baseOpts['toolCallConcurrency'] = 1;

      if (req.onApprove) {
        const onApprove = req.onApprove;
        baseOpts['toolApproval'] = async ({
          toolCall,
        }: {
          toolCall: { toolCallId: string; toolName: string; input: unknown };
        }) => {
          const decision = await onApprove({
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.input,
          });
          return decision === 'allow' ? 'approved' : 'denied';
        };
      }
    }

    // Stream and map parts
    try {
      const result = this.streamText(baseOpts);
      for await (const rawPart of result.stream) {
        const done = this._handlePart(rawPart);
        if (done !== null) {
          yield done.event;
          if (done.stop) return;
        }
      }
      // Stream ended normally
      yield { type: 'done', reason: req.abortSignal.aborted ? 'aborted' : 'stop' };
    } catch (err) {
      if (req.abortSignal.aborted) {
        yield { type: 'done', reason: 'aborted' };
      } else {
        yield { type: 'error', message: describeAiError(err) };
      }
    }
  }

  /**
   * Maps a raw SDK stream part to a RunEvent.
   * Returns `{ event, stop: boolean }` or null to skip.
   */
  private _handlePart(rawPart: unknown): { event: RunEvent; stop: boolean } | null {
    if (!rawPart || typeof rawPart !== 'object') return null;
    const part = rawPart as Record<string, unknown>;

    switch (part['type']) {
      case 'text-delta': {
        if (typeof part['text'] !== 'string') return null;
        return { event: { type: 'text-delta', text: part['text'] }, stop: false };
      }
      case 'reasoning-delta': {
        if (typeof part['text'] !== 'string') return null;
        return { event: { type: 'reasoning-delta', text: part['text'] }, stop: false };
      }
      case 'source': {
        if (typeof part['url'] !== 'string') return null;
        const src: RunEvent = {
          type: 'source',
          url: part['url'],
          ...(typeof part['title'] === 'string' ? { title: part['title'] } : {}),
        };
        return { event: src, stop: false };
      }
      case 'tool-call': {
        return {
          event: {
            type: 'tool-call',
            toolCallId: String(part['toolCallId'] ?? ''),
            toolName: String(part['toolName'] ?? ''),
            input: part['input'],
          },
          stop: false,
        };
      }
      case 'tool-result': {
        return {
          event: {
            type: 'tool-result',
            toolCallId: String(part['toolCallId'] ?? ''),
            toolName: String(part['toolName'] ?? ''),
            output: part['output'],
            isError: false,
          },
          stop: false,
        };
      }
      case 'tool-error': {
        return {
          event: {
            type: 'tool-result',
            toolCallId: String(part['toolCallId'] ?? ''),
            toolName: String(part['toolName'] ?? ''),
            output: describeAiError(part['error']),
            isError: true,
          },
          stop: false,
        };
      }
      case 'tool-output-denied': {
        return {
          event: {
            type: 'tool-result',
            toolCallId: String(part['toolCallId'] ?? ''),
            toolName: String(part['toolName'] ?? ''),
            output: 'Denied by permission policy or user.',
            isError: true,
          },
          stop: false,
        };
      }
      case 'error': {
        return {
          event: { type: 'error', message: describeAiError(part['error']) },
          stop: true,
        };
      }
      case 'abort': {
        return {
          event: { type: 'done', reason: 'aborted' },
          stop: true,
        };
      }
      default:
        return null;
    }
  }
}
