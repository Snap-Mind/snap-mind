// DeepSeek Provider — thin wrapper around UnifiedProvider for backward compatibility.
// All business logic is in adapters/deepseekAdapter.ts and UnifiedProvider.ts.

import { DeepSeekConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { deepseekAdapter } from './adapters/deepseekAdapter';
import { deriveV1ApiBase } from './core/urlResolvers';

class DeepSeekProvider extends UnifiedProvider {
  constructor(config: DeepSeekConfig) {
    super(config, deepseekAdapter);
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
