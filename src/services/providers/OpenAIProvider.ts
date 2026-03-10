// OpenAI Provider — thin wrapper for backward compatibility.
// All logic is composed from adapters/openaiRequestBuilder + parsers/openaiResponseParser.

import { OpenAIConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { adapterMap } from './ProviderFactory';
import { deriveV1ApiBase } from './urlResolvers';

class OpenAIProvider extends UnifiedProvider {
  constructor(config: OpenAIConfig) {
    super(config, adapterMap.openai);
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
