// Azure OpenAI Provider — thin wrapper around UnifiedProvider for backward compatibility.
// All business logic is in adapters/azureAdapter.ts and UnifiedProvider.ts.

import { AzureOpenAIConfig } from '@/types/providers';
import { UnifiedProvider } from './UnifiedProvider';
import { azureOpenaiAdapter } from './adapters/azureAdapter';

class AzureOpenAIProvider extends UnifiedProvider {
  constructor(config: AzureOpenAIConfig) {
    super(config, azureOpenaiAdapter);
  }
}

export default AzureOpenAIProvider;
