// Anthropic Provider — thin wrapper for backward compatibility.
// All logic is composed from adapters/anthropicRequestBuilder + parsers/anthropicResponseParser.

import { AnthropicConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { adapterMap } from './ProviderFactory';
import { deriveV1ApiBase } from './urlResolvers';

class AnthropicProvider extends UnifiedProvider {
  constructor(config: AnthropicConfig) {
    super(config, adapterMap.anthropic);
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
