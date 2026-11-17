import type { RunEvent, StreamRequest } from './types.js';

export interface ModelRuntime {
  stream(_req: StreamRequest): AsyncIterable<RunEvent>;
}
