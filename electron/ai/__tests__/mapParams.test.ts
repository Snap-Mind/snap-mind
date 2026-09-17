import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  mapParams,
  mapReasoningLevel,
} from '../mapParams.js';

describe('mapParams', () => {
  it('uses defaults when params are missing', () => {
    expect(mapParams()).toEqual({
      temperature: DEFAULT_TEMPERATURE,
      maxOutputTokens: DEFAULT_MAX_TOKENS,
      topP: DEFAULT_TOP_P,
      reasoning: false,
      webSearch: false,
    });
  });

  it('applies overrides', () => {
    expect(
      mapParams({
        temperature: 0.2,
        maxTokens: 512,
        topP: 0.5,
        reasoning: true,
        webSearch: true,
      })
    ).toEqual({
      temperature: 0.2,
      maxOutputTokens: 512,
      topP: 0.5,
      reasoning: true,
      webSearch: true,
    });
  });
});

describe('mapReasoningLevel', () => {
  it('maps enabled to medium effort', () => {
    expect(mapReasoningLevel(true)).toBe('medium');
  });

  it('maps disabled to none', () => {
    expect(mapReasoningLevel(false)).toBe('none');
  });
});
