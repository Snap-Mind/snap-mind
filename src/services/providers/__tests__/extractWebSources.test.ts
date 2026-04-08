import { describe, it, expect } from 'vitest';
import {
  extractOpenAISources,
  extractGeminiSources,
  deduplicateSources,
} from '../parsers/extractWebSources';

describe('extractOpenAISources', () => {
  it('should extract url_citation annotations from non-streaming response', () => {
    const data = {
      choices: [
        {
          message: {
            content: 'Some response text',
            annotations: [
              {
                type: 'url_citation',
                url_citation: {
                  url: 'https://example.com/article',
                  title: 'Example Article',
                },
              },
              {
                type: 'url_citation',
                url_citation: {
                  url: 'https://docs.example.com/guide',
                  title: 'Guide',
                },
              },
            ],
          },
        },
      ],
    };

    const sources = extractOpenAISources(data);
    expect(sources).toEqual([
      { url: 'https://example.com/article', title: 'Example Article' },
      { url: 'https://docs.example.com/guide', title: 'Guide' },
    ]);
  });

  it('should extract url_citation annotations from streaming delta', () => {
    const data = {
      choices: [
        {
          delta: {
            annotations: [
              {
                type: 'url_citation',
                url_citation: {
                  url: 'https://stream.example.com/page',
                  title: 'Stream Page',
                },
              },
            ],
          },
        },
      ],
    };

    const sources = extractOpenAISources(data);
    expect(sources).toEqual([{ url: 'https://stream.example.com/page', title: 'Stream Page' }]);
  });

  it('should skip non-url_citation annotations', () => {
    const data = {
      choices: [
        {
          message: {
            annotations: [
              { type: 'file_citation', file_citation: { file_id: 'abc' } },
              {
                type: 'url_citation',
                url_citation: { url: 'https://real.com', title: 'Real' },
              },
            ],
          },
        },
      ],
    };

    const sources = extractOpenAISources(data);
    expect(sources).toHaveLength(1);
    expect(sources[0].url).toBe('https://real.com');
  });

  it('should return empty array when no annotations', () => {
    expect(extractOpenAISources({})).toEqual([]);
    expect(extractOpenAISources({ choices: [{ delta: { content: 'hi' } }] })).toEqual([]);
  });

  it('should handle url_citation without title', () => {
    const data = {
      choices: [
        {
          message: {
            annotations: [{ type: 'url_citation', url_citation: { url: 'https://no-title.com' } }],
          },
        },
      ],
    };

    const sources = extractOpenAISources(data);
    expect(sources).toEqual([{ url: 'https://no-title.com', title: undefined }]);
  });
});

describe('extractGeminiSources', () => {
  it('should extract grounding chunks from response', () => {
    const data = {
      candidates: [
        {
          content: { parts: [{ text: 'Response' }] },
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: 'https://gemini.example.com/a', title: 'Gemini A' } },
              { web: { uri: 'https://gemini.example.com/b', title: 'Gemini B' } },
            ],
          },
        },
      ],
    };

    const sources = extractGeminiSources(data);
    expect(sources).toEqual([
      { url: 'https://gemini.example.com/a', title: 'Gemini A' },
      { url: 'https://gemini.example.com/b', title: 'Gemini B' },
    ]);
  });

  it('should handle chunks without title', () => {
    const data = {
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [{ web: { uri: 'https://notitle.com' } }],
          },
        },
      ],
    };

    const sources = extractGeminiSources(data);
    expect(sources).toEqual([{ url: 'https://notitle.com', title: undefined }]);
  });

  it('should skip non-web chunks', () => {
    const data = {
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: 'https://web.com', title: 'Web' } },
              { retrievedContext: { uri: 'gs://bucket/file' } },
            ],
          },
        },
      ],
    };

    const sources = extractGeminiSources(data);
    expect(sources).toHaveLength(1);
    expect(sources[0].url).toBe('https://web.com');
  });

  it('should return empty array when no grounding metadata', () => {
    expect(extractGeminiSources({})).toEqual([]);
    expect(
      extractGeminiSources({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] })
    ).toEqual([]);
  });
});

describe('deduplicateSources', () => {
  it('should remove duplicate URLs keeping first occurrence', () => {
    const sources = [
      { url: 'https://a.com', title: 'First' },
      { url: 'https://b.com', title: 'B' },
      { url: 'https://a.com', title: 'Duplicate' },
    ];

    const result = deduplicateSources(sources);
    expect(result).toEqual([
      { url: 'https://a.com', title: 'First' },
      { url: 'https://b.com', title: 'B' },
    ]);
  });

  it('should handle empty array', () => {
    expect(deduplicateSources([])).toEqual([]);
  });

  it('should handle single item', () => {
    const sources = [{ url: 'https://only.com', title: 'Only' }];
    expect(deduplicateSources(sources)).toEqual(sources);
  });
});
