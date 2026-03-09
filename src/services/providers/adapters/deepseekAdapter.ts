// DeepSeek adapter — OpenAI-compatible, only differs in default origin.

import { createOpenAICompatibleAdapter } from './openaiCompatible';
import { deriveV1ApiBase } from '../core/urlResolvers';

const DEEPSEEK_DEFAULT_ORIGIN = 'https://api.deepseek.com';

export const deepseekAdapter = createOpenAICompatibleAdapter({
  providerName: 'DeepSeek',
  defaultOrigin: DEEPSEEK_DEFAULT_ORIGIN,
  deriveApiBase: (host) => deriveV1ApiBase(host, 'DeepSeek'),
  modelDescription: (model: any) => `DeepSeek ${model.id} model`,
});
