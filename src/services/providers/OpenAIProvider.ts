// OpenAI Provider — thin wrapper around UnifiedProvider for backward compatibility.
// All business logic is in adapters/openaiAdapter.ts and UnifiedProvider.ts.

import { OpenAIConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { openaiAdapter } from './adapters/openaiAdapter';
import { deriveV1ApiBase } from './core/urlResolvers';

class OpenAIProvider extends UnifiedProvider {
  constructor(config: OpenAIConfig) {
    super(config, openaiAdapter);
  }

  // URL helpers exposed for tests
  _deriveApiBase(host: string): string {
    return deriveV1ApiBase(host, 'OpenAI');
  }

  _buildChatCompletionsUrl(host: string): string {
    return `${this._deriveApiBase(host)}/chat/completions`;
  }

  _buildModelsUrl(host: string): string {
    return `${this._deriveApiBase(host)}/models`;
  }
}

export default OpenAIProvider;
