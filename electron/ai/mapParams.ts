export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 2048;
export const DEFAULT_TOP_P = 0.95;

export type AgentRunParams = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoning?: boolean;
  webSearch?: boolean;
};

export type MappedStreamParams = {
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  reasoning: boolean;
  webSearch: boolean;
};

export function mapParams(p?: AgentRunParams): MappedStreamParams {
  return {
    temperature: p?.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: p?.maxTokens ?? DEFAULT_MAX_TOKENS,
    topP: p?.topP ?? DEFAULT_TOP_P,
    reasoning: p?.reasoning ?? false,
    webSearch: p?.webSearch ?? false,
  };
}

/** Maps agent reasoning toggle to AI SDK streamText `reasoning` effort. */
export function mapReasoningLevel(enabled: boolean): 'medium' | 'none' {
  return enabled ? 'medium' : 'none';
}
