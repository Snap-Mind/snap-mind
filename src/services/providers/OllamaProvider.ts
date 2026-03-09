// Ollama Provider — thin wrapper around UnifiedProvider for backward compatibility.
// All business logic is in adapters/ollamaAdapter.ts and UnifiedProvider.ts.

import { BaseProviderConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { ollamaAdapter } from './adapters/ollamaAdapter';
import { deriveOllamaApiBase } from './core/urlResolvers';

class OllamaProvider extends UnifiedProvider {
  constructor(config: BaseProviderConfig) {
    super(config, ollamaAdapter);
  }

  // URL helpers exposed for tests
  _deriveApiBase(host: string): string {
    return deriveOllamaApiBase(host);
  }

  _buildChatUrl(host: string): string {
    return `${this._deriveApiBase(host)}/chat`;
  }
}

export default OllamaProvider;
