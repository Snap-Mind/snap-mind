// Qwen Provider — thin wrapper for backward compatibility.
// All logic is composed from adapters/openaiRequestBuilder + parsers/openaiResponseParser.

import { QwenConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { adapterMap } from './ProviderFactory';
import { deriveQwenApiBase } from './urlResolvers';

class QwenProvider extends UnifiedProvider {
  constructor(config: QwenConfig) {
    super(config, adapterMap.qwen);
  }

  // URL helpers exposed for tests
  _deriveApiBase(host: string): string {
    return deriveQwenApiBase(host);
  }

  _buildChatUrl(host: string): string {
    return `${this._deriveApiBase(host)}/chat/completions`;
  }

  _buildModelsUrl(host: string): string {
    return `${this._deriveApiBase(host)}/models`;
  }
}

export default QwenProvider;
