// Azure OpenAI Provider — thin wrapper for backward compatibility.
// All logic is composed from adapters/azureRequestBuilder + parsers/openaiResponseParser.

import { AzureOpenAIConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { adapterMap } from './ProviderFactory';

class AzureOpenAIProvider extends UnifiedProvider {
  constructor(config: AzureOpenAIConfig) {
    super(config, adapterMap['azure-openai']);
  }
}

export default AzureOpenAIProvider;
