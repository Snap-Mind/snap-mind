import { describe, expect, it } from 'vitest';
import { deriveFoundryProjectApiBase, deriveFoundryResourceOrigin } from '../core/urlResolvers';

describe('deriveFoundryProjectApiBase', () => {
  it('builds project endpoint when host has no embedded project path', () => {
    expect(
      deriveFoundryProjectApiBase('https://my-foundry.services.ai.azure.com', 'my-project')
    ).toBe('https://my-foundry.services.ai.azure.com/api/projects/my-project');
  });

  it('keeps embedded project endpoint from host', () => {
    expect(
      deriveFoundryProjectApiBase(
        'https://my-foundry.services.ai.azure.com/api/projects/embedded-project',
        'ignored-project'
      )
    ).toBe('https://my-foundry.services.ai.azure.com/api/projects/embedded-project');
  });

  it('keeps embedded project endpoint when host has trailing segments', () => {
    expect(
      deriveFoundryProjectApiBase(
        'https://my-foundry.services.ai.azure.com/api/projects/embedded-project/openai/v1/chat/completions',
        'ignored-project'
      )
    ).toBe('https://my-foundry.services.ai.azure.com/api/projects/embedded-project');
  });

  it('throws missing project name for valid host without project path', () => {
    expect(() =>
      deriveFoundryProjectApiBase('https://my-foundry.services.ai.azure.com')
    ).toThrow('Missing project name');
  });

  it('throws invalid host for malformed URL', () => {
    expect(() => deriveFoundryProjectApiBase('not-a-url', 'my-project')).toThrow(
      'Invalid Foundry host URL: not-a-url'
    );
  });
});

describe('deriveFoundryResourceOrigin', () => {
  it('returns origin from full foundry URL', () => {
    expect(
      deriveFoundryResourceOrigin(
        'https://my-foundry.services.ai.azure.com/api/projects/my-project/openai/v1/chat/completions'
      )
    ).toBe('https://my-foundry.services.ai.azure.com');
  });

  it('throws invalid host for malformed URL', () => {
    expect(() => deriveFoundryResourceOrigin('invalid')).toThrow(
      'Invalid Foundry host URL: invalid'
    );
  });
});
