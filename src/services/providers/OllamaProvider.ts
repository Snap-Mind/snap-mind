// Ollama Provider — thin wrapper for backward compatibility.
// All logic is composed from adapters/ollamaRequestBuilder + parsers/ollamaResponseParser.

import { BaseProviderConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { adapterMap } from './ProviderFactory';
import { deriveOllamaApiBase } from './urlResolvers';

class OllamaProvider extends UnifiedProvider {
  constructor(config: BaseProviderConfig) {
    super(config, adapterMap.ollama);
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
