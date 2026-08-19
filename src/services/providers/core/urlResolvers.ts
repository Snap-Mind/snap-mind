// URL derivation strategies for different provider API patterns.
// Each resolver normalizes a user-supplied host string into a proper API base URL.

/**
 * Derive API base URL ending with /v1.
 * Handles hosts with or without /v1, with nested paths, trailing slashes, etc.
 *
 * Examples:
 * - "https://api.openai.com"         → "https://api.openai.com/v1"
 * - "https://api.openai.com/v1"      → "https://api.openai.com/v1"
 * - "https://proxy.com/openai/v1"    → "https://proxy.com/openai/v1"
 * - "https://custom.com/api/service" → "https://custom.com/api/service/v1"
 *
 * Used by: OpenAI, Anthropic, DeepSeek.
 */
export function deriveV1ApiBase(host: string, providerName: string): string {
  try {
    const url = new URL(host);
    const parts = url.pathname.split('/').filter(Boolean);
    const v1Index = parts.indexOf('v1');
    let basePath: string;
    if (v1Index >= 0) {
      basePath = '/' + parts.slice(0, v1Index + 1).join('/');
    } else {
      const path = parts.join('/');
      basePath = path ? `/${path}/v1` : '/v1';
    }
    url.pathname = basePath.replace(/\/$/, '');
    return url.origin + url.pathname;
  } catch {
    throw new Error(`Invalid ${providerName} host URL: ${host}`);
  }
}

/**
 * Derive API base URL with /compatible-mode/v1 for Qwen/DashScope.
 *
 * Examples:
 * - "https://dashscope.aliyuncs.com"                    → "https://dashscope.aliyuncs.com/compatible-mode/v1"
 * - "https://dashscope.aliyuncs.com/compatible-mode"    → "https://dashscope.aliyuncs.com/compatible-mode/v1"
 * - "https://dashscope.aliyuncs.com/compatible-mode/v1" → "https://dashscope.aliyuncs.com/compatible-mode/v1"
 */
export function deriveQwenApiBase(host: string): string {
  try {
    const url = new URL(host);
    const parts = url.pathname.split('/').filter(Boolean);
    const compatIndex = parts.indexOf('compatible-mode');
    const vIndex = parts.findIndex((p) => /^v\d/.test(p));

    let baseParts: string[];
    if (compatIndex >= 0) {
      if (vIndex > compatIndex) {
        baseParts = parts.slice(0, vIndex + 1);
      } else {
        baseParts = parts.slice(0, compatIndex + 1).concat(['v1']);
      }
    } else {
      baseParts = ['compatible-mode', 'v1'];
    }

    url.pathname = '/' + baseParts.join('/');
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch {
    throw new Error(`Invalid Qwen host URL: ${host}`);
  }
}

/**
 * Derive API base URL for Google Generative Language API.
 * Finds a version segment (v1, v1beta, etc.) or appends v1beta.
 *
 * Examples:
 * - "https://generativelanguage.googleapis.com"        → "https://generativelanguage.googleapis.com/v1beta"
 * - "https://generativelanguage.googleapis.com/v1beta" → "https://generativelanguage.googleapis.com/v1beta"
 * - "https://generativelanguage.googleapis.com/v1"     → "https://generativelanguage.googleapis.com/v1"
 */
export function deriveGoogleApiBase(host: string): string {
  try {
    const url = new URL(host);
    const parts = url.pathname.split('/').filter(Boolean);
    const versionIndex = parts.findIndex((p) => /^v\d/.test(p));
    let baseParts: string[];
    if (versionIndex >= 0) {
      baseParts = parts.slice(0, versionIndex + 1);
    } else {
      baseParts = parts.concat('v1beta');
    }
    url.pathname = '/' + baseParts.join('/');
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch {
    throw new Error(`Invalid Google host URL: ${host}`);
  }
}

/**
 * Derive API base URL ending with /api for Ollama.
 * Falls back to the default Ollama origin on invalid input.
 *
 * Examples:
 * - "http://localhost:11434"          → "http://localhost:11434/api"
 * - "http://localhost:11434/api"      → "http://localhost:11434/api"
 * - "http://localhost:11434/api/chat" → "http://localhost:11434/api"
 * - "http://my-server.com/ollama/api" → "http://my-server.com/ollama/api"
 */
export function deriveOllamaApiBase(host: string): string {
  try {
    const url = new URL(host);
    const parts = url.pathname.split('/').filter(Boolean);
    const apiIndex = parts.indexOf('api');
    const basePath = apiIndex >= 0 ? '/' + parts.slice(0, apiIndex + 1).join('/') : '/api';
    url.pathname = basePath.replace(/\/$/, '');
    return url.origin + url.pathname;
  } catch {
    return 'http://localhost:11434/api';
  }
}
