// Extracts web search citation sources from provider-specific response shapes
// into a unified ChatSource[] format.

import { ChatSource } from '@/types/chat';

/**
 * Extract sources from an OpenAI response chunk or full response.
 *
 * Streaming: annotations appear in `choices[0].delta.annotations`.
 * Non-streaming: annotations appear in `choices[0].message.annotations`.
 */
export function extractOpenAISources(data: any): ChatSource[] {
  const annotations =
    data.choices?.[0]?.delta?.annotations ?? data.choices?.[0]?.message?.annotations;

  if (!Array.isArray(annotations)) return [];

  const sources: ChatSource[] = [];
  for (const ann of annotations) {
    if (ann.type === 'url_citation' && ann.url_citation?.url) {
      sources.push({
        url: ann.url_citation.url,
        title: ann.url_citation.title || undefined,
      });
    }
  }
  return sources;
}

/**
 * Extract sources from a Gemini response chunk or full response.
 *
 * Grounding metadata lives at `candidates[0].groundingMetadata.groundingChunks`.
 */
export function extractGeminiSources(data: any): ChatSource[] {
  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks;

  if (!Array.isArray(chunks)) return [];

  const sources: ChatSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (uri) {
      sources.push({
        url: uri,
        title: chunk.web?.title || undefined,
      });
    }
  }
  return sources;
}

/** Deduplicate sources by URL, keeping the first occurrence's title. */
export function deduplicateSources(sources: ChatSource[]): ChatSource[] {
  const seen = new Map<string, ChatSource>();
  for (const s of sources) {
    if (!seen.has(s.url)) {
      seen.set(s.url, s);
    }
  }
  return Array.from(seen.values());
}
