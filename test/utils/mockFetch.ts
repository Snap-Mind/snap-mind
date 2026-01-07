import { vi } from 'vitest';

/**
 * Mock fetch response helper
 */
export function mockFetchResponse(data: any, options: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = options;

  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    body: null,
  } as Response;
}

/**
 * Mock streaming fetch response
 */
export function mockStreamingFetchResponse(chunks: string[]) {
  const encoder = new TextEncoder();

  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => {
        let chunkIndex = 0;
        return {
          read: vi.fn(async () => {
            if (chunkIndex < chunks.length) {
              const chunk = chunks[chunkIndex++];
              return { value: encoder.encode(chunk), done: false };
            }
            return { value: undefined, done: true };
          }),
        };
      },
    },
  } as unknown as Response;
}

/**
 * Mock SSE (Server-Sent Events) streaming response
 */
export function mockSSEResponse(events: Array<{ type?: string; data: any }>) {
  const chunks = events.map((event) => {
    const type = event.type || 'content_block_delta';
    return `data: ${JSON.stringify({ type, ...event.data })}\n\n`;
  });
  chunks.push('data: [DONE]\n\n');

  return mockStreamingFetchResponse(chunks);
}

/**
 * Reset fetch mock
 */
export function resetFetchMock() {
  (global.fetch as any).mockReset();
}

/**
 * Setup fetch mock to return a response
 */
export function setupFetchMock(response: Response) {
  (global.fetch as any).mockResolvedValueOnce(response);
}

/**
 * Setup fetch mock to reject with an error
 */
export function setupFetchError(error: Error) {
  (global.fetch as any).mockRejectedValueOnce(error);
}
