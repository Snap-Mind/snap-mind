// Google (Gemini) Provider — thin wrapper for backward compatibility.
// All logic is composed from adapters/googleRequestBuilder + parsers/googleResponseParser.

import { GoogleConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { adapterMap } from './ProviderFactory';
import { deriveGoogleApiBase } from './urlResolvers';

class GoogleProvider extends UnifiedProvider {
  constructor(config: GoogleConfig) {
    super(config, adapterMap.google);
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
