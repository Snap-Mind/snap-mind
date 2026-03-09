// Qwen adapter — OpenAI-compatible, differs in URL derivation (compatible-mode/v1).

import { createOpenAICompatibleAdapter } from './openaiCompatible';
import { deriveQwenApiBase } from '../core/urlResolvers';

const QWEN_DEFAULT_ORIGIN = 'https://dashscope.aliyuncs.com';

export const qwenAdapter = createOpenAICompatibleAdapter({
  providerName: 'Qwen',
  defaultOrigin: QWEN_DEFAULT_ORIGIN,
  deriveApiBase: (host) => deriveQwenApiBase(host),
  modelDescription: (model: any) => `Qwen ${model.id} model`,
});
