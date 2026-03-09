// OpenAI adapter — uses the shared OpenAI-compatible factory.
// Only customizes: default origin, URL resolver, and model filter (gpt only).

import { createOpenAICompatibleAdapter } from './openaiCompatible';
import { deriveV1ApiBase } from '../core/urlResolvers';

const OPENAI_DEFAULT_ORIGIN = 'https://api.openai.com';

export const openaiAdapter = createOpenAICompatibleAdapter({
  providerName: 'OpenAI',
  defaultOrigin: OPENAI_DEFAULT_ORIGIN,
  deriveApiBase: (host) => deriveV1ApiBase(host, 'OpenAI'),
  modelFilter: (model: any) => model.id.includes('gpt'),
  modelDescription: (model: any) => `OpenAI ${model.id} model`,
});
