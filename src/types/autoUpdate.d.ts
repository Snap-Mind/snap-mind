export type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available'; version?: string }
  | { type: 'not-available' }
  | { type: 'error'; message: string }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded'; version?: string };

export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; info: any }
  | { type: 'not-available'; info: any }
  | { type: 'error'; error: string }
  | {
      type: 'download-progress';
      progress: { percent: number; transferred: number; total: number; bytesPerSecond: number };
    }
  | { type: 'downloaded'; info: any };
