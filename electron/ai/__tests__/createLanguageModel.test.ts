import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  openaiFactory,
  azureFactory,
  anthropicFactory,
  googleFactory,
  openaiCompatibleFactory,
  ollamaFactory,
} = vi.hoisted(() => ({
  openaiFactory: vi.fn(() => vi.fn(() => ({ provider: 'openai' }))),
  azureFactory: vi.fn(() => vi.fn(() => ({ provider: 'azure' }))),
  anthropicFactory: vi.fn(() => vi.fn(() => ({ provider: 'anthropic' }))),
  googleFactory: vi.fn(() => vi.fn(() => ({ provider: 'google' }))),
  openaiCompatibleFactory: vi.fn(() => vi.fn(() => ({ provider: 'compatible' }))),
  ollamaFactory: vi.fn(() => vi.fn(() => ({ provider: 'ollama' }))),
}));

vi.mock('@ai-sdk/openai', () => ({ createOpenAI: openaiFactory }));
vi.mock('@ai-sdk/azure', () => ({ createAzure: azureFactory }));
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: anthropicFactory }));
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: googleFactory }));
vi.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: openaiCompatibleFactory }));
vi.mock('ollama-ai-provider', () => ({ createOllama: ollamaFactory }));

import { createLanguageModel } from '../createLanguageModel.js';

describe('createLanguageModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes /v1 baseURL and apiKey for openai', () => {
    createLanguageModel(
      { kind: 'openai', apiKey: 'sk-test', host: 'https://api.openai.com' },
      'gpt-4o'
    );
    expect(openaiFactory).toHaveBeenCalledWith({
      apiKey: 'sk-test',
      baseURL: 'https://api.openai.com/v1',
    });
  });

  it('calls ollama without apiKey', () => {
    createLanguageModel({ kind: 'ollama', apiKey: null, host: 'http://localhost:11434' }, 'llama3');
    expect(ollamaFactory).toHaveBeenCalledWith({
      baseURL: 'http://localhost:11434/api',
    });
    expect(ollamaFactory.mock.calls[0][0]).not.toHaveProperty('apiKey');
  });

  it('throws for unknown provider kind', () => {
    expect(() =>
      createLanguageModel({ kind: 'foundry', apiKey: 'x', host: 'https://example.com' }, 'm')
    ).toThrow('Unknown provider kind: foundry');
  });
});
