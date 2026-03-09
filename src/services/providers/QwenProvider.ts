// Qwen Provider — thin wrapper around UnifiedProvider for backward compatibility.
// All business logic is in adapters/qwenAdapter.ts and UnifiedProvider.ts.

import { QwenConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { qwenAdapter } from './adapters/qwenAdapter';
import { deriveQwenApiBase } from './core/urlResolvers';

class QwenProvider extends UnifiedProvider {
  constructor(config: QwenConfig) {
    super(config, qwenAdapter);
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
