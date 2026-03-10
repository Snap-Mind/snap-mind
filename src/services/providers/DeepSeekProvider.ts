// DeepSeek Provider — thin wrapper for backward compatibility.
// All logic is composed from adapters/openaiRequestBuilder + parsers/openaiResponseParser.

import { DeepSeekConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { adapterMap } from './ProviderFactory';
import { deriveV1ApiBase } from './urlResolvers';

class DeepSeekProvider extends UnifiedProvider {
  constructor(config: DeepSeekConfig) {
    super(config, adapterMap.deepseek);
  }

  // URL helpers exposed for tests
  _deriveApiBase(host: string): string {
    return deriveV1ApiBase(host, 'DeepSeek');
  }

  _buildChatUrl(host: string): string {
    return `${this._deriveApiBase(host)}/chat/completions`;
  }

  _buildModelsUrl(host: string): string {
    return `${this._deriveApiBase(host)}/models`;
  }
}

export default DeepSeekProvider;
