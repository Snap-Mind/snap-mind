export type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available'; version?: string }
  | { type: 'not-available' }
  | { type: 'error'; message: string }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version?: string };