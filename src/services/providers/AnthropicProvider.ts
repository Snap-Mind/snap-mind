// Anthropic Provider — thin wrapper around UnifiedProvider for backward compatibility.
// All business logic is in adapters/anthropicAdapter.ts and UnifiedProvider.ts.

import { AnthropicConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { anthropicAdapter } from './adapters/anthropicAdapter';
import { deriveV1ApiBase } from './core/urlResolvers';

class AnthropicProvider extends UnifiedProvider {
  constructor(config: AnthropicConfig) {
    super(config, anthropicAdapter);
  }

  // URL helpers exposed for tests
  _deriveApiBase(host: string): string {
    return deriveV1ApiBase(host, 'Anthropic');
  }

  _buildMessagesUrl(host: string): string {
    return `${this._deriveApiBase(host)}/messages`;
  }

  _buildModelsUrl(host: string): string {
    return `${this._deriveApiBase(host)}/models`;
  }
}

export default AnthropicProvider;
