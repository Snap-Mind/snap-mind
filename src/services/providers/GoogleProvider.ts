// Google (Gemini) Provider — thin wrapper around UnifiedProvider for backward compatibility.
// All business logic is in adapters/googleAdapter.ts and UnifiedProvider.ts.

import { GoogleConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { googleAdapter } from './adapters/googleAdapter';
import { deriveGoogleApiBase } from './core/urlResolvers';

class GoogleProvider extends UnifiedProvider {
  constructor(config: GoogleConfig) {
    super(config, googleAdapter);
  }

  // URL helpers exposed for tests
  _deriveApiBase(host: string): string {
    return deriveGoogleApiBase(host);
  }

  _buildGenerateContentUrl(
    host: string,
    model: string,
    apiKey: string,
    streaming: boolean
  ): string {
    const base = this._deriveApiBase(host);
    return `${base}/models/${model}:generateContent?key=${apiKey}${streaming ? '&alt=sse' : ''}`;
  }

  _buildModelsUrl(host: string, apiKey: string): string {
    const base = this._deriveApiBase(host);
    return `${base}/models?key=${apiKey}`;
  }
}

export default GoogleProvider;
