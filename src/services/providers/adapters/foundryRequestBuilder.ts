import { Message } from '@/types/chat';
import { BaseProviderConfig, FoundryConfig, ProviderOptions, RequestBuilder } from '@/types/providers';
import { deriveFoundryProjectApiBase, deriveFoundryResourceOrigin } from '../core/urlResolvers';

const DEFAULT_ENTRA_SCOPE = 'https://ai.azure.com/.default';
const ANTHROPIC_API_VERSION = '2023-06-01';
const ANTHROPIC_THINKING_BETA = 'interleaved-thinking-2025-05-14';
const ANTHROPIC_MESSAGES_PATH = '/anthropic/v1/messages';
const OPENAI_CHAT_COMPLETIONS_PATH = '/openai/v1/chat/completions';
const REASONING_EFFORT_MEDIUM = 'medium';
const REASONING_THINKING_TYPE_ENABLED = 'enabled';
const THINKING_BUDGET_RATIO = 0.8;
const MIN_THINKING_BUDGET_TOKENS = 1024;
const DEFAULT_MAX_TOKENS_FALLBACK = 2048;
const MODEL_PREFIX_CLAUDE = 'claude';
const REASONING_MODEL_PREFIXES = ['gpt-5', 'o1', 'o3', 'o4'] as const;

function isClaudeModel(model?: string): boolean {
  if (!model) return false;
  return model.toLowerCase().startsWith(MODEL_PREFIX_CLAUDE);
}

function startsWithAnyPrefix(modelId: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => modelId.startsWith(prefix));
}

function requiresMaxCompletionTokens(model?: string): boolean {
  if (!model) return false;
  const id = model.toLowerCase();
  return startsWithAnyPrefix(id, REASONING_MODEL_PREFIXES);
}

function supportsGptReasoningEffort(model?: string): boolean {
  if (!model) return false;
  const id = model.toLowerCase();
  return startsWithAnyPrefix(id, REASONING_MODEL_PREFIXES);
}

export const foundryRequestBuilder: RequestBuilder = {
  providerName: 'Azure AI Foundry',
  requiresApiKey: false,

  validateRequest(config: BaseProviderConfig, options?: ProviderOptions): string | null {
    const foundryConfig = config as FoundryConfig;
    const hasProjectInHost = config.host?.includes('/api/projects/');
    const model = options?.model;

    if (!config.host) {
      return 'Foundry endpoint is not configured';
    }
    if (!isClaudeModel(model) && !hasProjectInHost && !foundryConfig.projectName) {
      return 'Foundry project name is required when host does not include /api/projects/{project}';
    }
    if (!foundryConfig.entraScope) {
      return 'Foundry Entra scope is not configured';
    }
    if (!model) {
      return 'Model not specified for Azure AI Foundry';
    }
    return null;
  },

  buildChatUrl(config: BaseProviderConfig, options?: ProviderOptions): string {
    const foundryConfig = config as FoundryConfig;
    if (isClaudeModel(options?.model)) {
      return `${deriveFoundryResourceOrigin(config.host)}${ANTHROPIC_MESSAGES_PATH}`;
    }
    const base = deriveFoundryProjectApiBase(config.host, foundryConfig.projectName);
    return `${base}${OPENAI_CHAT_COMPLETIONS_PATH}`;
  },

  buildChatHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  },

  async buildChatHeadersAsync(
    config: BaseProviderConfig,
    options?: ProviderOptions
  ): Promise<Record<string, string>> {
    const foundryConfig = config as FoundryConfig;
    const scope = foundryConfig.entraScope || DEFAULT_ENTRA_SCOPE;
    const authResult = await window.electronAPI.getFoundryCliToken(scope);

    if (!authResult.success || !authResult.token) {
      throw new Error(
        authResult.error ||
          'Unable to acquire Foundry access token. Please ensure Azure CLI is installed and logged in.'
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authResult.token}`,
    };
    if (isClaudeModel(options?.model)) {
      headers['Anthropic-Version'] = ANTHROPIC_API_VERSION;
      if (options?.reasoning) {
        headers['Anthropic-Beta'] = ANTHROPIC_THINKING_BETA;
      }
    }
    return headers;
  },

  buildChatBody(messages: Message[], options: ProviderOptions): any {
    if (isClaudeModel(options.model)) {
      let systemPrompt = '';
      const anthropicMessages: { role: string; content: string }[] = [];
      for (const message of messages) {
        if (message.role === 'system') {
          systemPrompt = message.content;
        } else {
          anthropicMessages.push({ role: message.role, content: message.content });
        }
      }

      const body: any = {
        model: options.model,
        messages: anthropicMessages,
        system: systemPrompt,
        max_tokens: options.max_tokens,
        stream: options.stream !== undefined ? options.stream : true,
      };

      if (options.reasoning) {
        body.temperature = 1;
        const userMaxTokens =
          typeof options?.max_tokens === 'number' ? options.max_tokens : undefined;
        let budgetTokens: number;
        if (userMaxTokens && userMaxTokens > 0) {
          const baseBudget = Math.floor(userMaxTokens * THINKING_BUDGET_RATIO);
          budgetTokens = Math.min(
            userMaxTokens,
            Math.max(MIN_THINKING_BUDGET_TOKENS, baseBudget)
          );
        } else {
          const baseBudget = Math.floor(DEFAULT_MAX_TOKENS_FALLBACK * THINKING_BUDGET_RATIO);
          budgetTokens = Math.max(MIN_THINKING_BUDGET_TOKENS, baseBudget);
        }
        body.thinking = { type: REASONING_THINKING_TYPE_ENABLED, budget_tokens: budgetTokens };
      } else {
        // Some Claude deployments reject requests when both temperature and top_p are provided.
        // Keep a single sampling control to maximize compatibility.
        if (typeof options.temperature === 'number') {
          body.temperature = options.temperature;
        } else if (typeof options.top_p === 'number') {
          body.top_p = options.top_p;
        }
      }
      return body;
    }

    if (options.reasoning) {
      const body: any = {
        model: options.model,
        messages,
        max_completion_tokens: options.max_tokens,
        stream: options.stream !== undefined ? options.stream : true,
      };
      if (supportsGptReasoningEffort(options.model)) {
        body.reasoning_effort = REASONING_EFFORT_MEDIUM;
      }
      return body;
    }

    const body: any = {
      model: options.model,
      messages,
      stream: options.stream !== undefined ? options.stream : true,
    };
    if (requiresMaxCompletionTokens(options.model)) {
      body.max_completion_tokens = options.max_tokens;
    } else {
      body.max_tokens = options.max_tokens;
      body.temperature = options.temperature;
      body.top_p = options.top_p;
    }
    return body;
  },

  buildListModelsRequest(): null {
    return null;
  },
};
