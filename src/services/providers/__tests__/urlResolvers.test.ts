import { describe, it, expect } from 'vitest';
import { deriveV1ApiBase, deriveQwenApiBase } from '../core/urlResolvers';

describe('deriveV1ApiBase', () => {
  it('appends /v1 when missing', () => {
    expect(deriveV1ApiBase('https://api.openai.com', 'OpenAI')).toBe('https://api.openai.com/v1');
  });
});

describe('deriveQwenApiBase', () => {
  it('adds compatible-mode/v1', () => {
    expect(deriveQwenApiBase('https://dashscope.aliyuncs.com')).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    );
  });
});
