import { createOpenAI } from '@ai-sdk/openai';
import { createAzure } from '@ai-sdk/azure';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOllama } from 'ollama-ai-provider';
import type { LanguageModel } from 'ai';
import {
  deriveGoogleApiBase,
  deriveOllamaApiBase,
  deriveQwenApiBase,
  deriveV1ApiBase,
} from './urlResolvers.js';

export type LanguageModelConfig = {
  kind: string;
  apiKey: string | null;
  host: string;
  apiVersion?: string | null;
};

export function createLanguageModel(config: LanguageModelConfig, modelId: string): LanguageModel {
  const { kind, apiKey, host, apiVersion } = config;

  switch (kind) {
    case 'openai':
      return createOpenAI({
        apiKey: apiKey ?? undefined,
        baseURL: deriveV1ApiBase(host, 'OpenAI'),
      })(modelId);
    case 'azure-openai':
      return createAzure({
        apiKey: apiKey ?? undefined,
        baseURL: host,
        apiVersion: apiVersion ?? undefined,
        useDeploymentBasedUrls: true,
      })(modelId);
    case 'anthropic':
      return createAnthropic({
        apiKey: apiKey ?? undefined,
        baseURL: deriveV1ApiBase(host, 'Anthropic'),
      })(modelId);
    case 'google':
      return createGoogleGenerativeAI({
        apiKey: apiKey ?? undefined,
        baseURL: deriveGoogleApiBase(host),
      })(modelId);
    case 'deepseek':
      return createOpenAICompatible({
        name: 'deepseek',
        apiKey: apiKey ?? undefined,
        baseURL: deriveV1ApiBase(host, 'DeepSeek'),
      })(modelId);
    case 'qwen':
      return createOpenAICompatible({
        name: 'qwen',
        apiKey: apiKey ?? undefined,
        baseURL: deriveQwenApiBase(host),
      })(modelId);
    case 'ollama':
      return createOllama({
        baseURL: deriveOllamaApiBase(host),
      })(modelId);
    default:
      throw new Error(`Unknown provider kind: ${kind}`);
  }
}
