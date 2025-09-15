import { UpdateEvent, UpdateStatus } from '@/types/autoUpdate';

export class AutoUpdateManager {
  private status: UpdateStatus = { type: 'idle' };
  private unsubscribe: (() => void) | null = null;
  private listeners: Set<(status: UpdateStatus) => void> = new Set();

  async initialize(): Promise<void> {
    const event = await window.electronAPI.getUpdateStatus?.();
    if (event) this.status = this.translate(event);

    // TODO: add log service

    // Subscribe to streaming events
    const handler = (event: UpdateEvent) => {
      this.status = this.translate(event);
      this.emit();
    };
    window.electronAPI.onUpdateEvent?.(handler);
    this.unsubscribe = () => {
      // Current preload only exposes removeAll; safe because we own the sole subscription
      window.electronAPI.offUpdateEvent?.();
    };

    // Emit initial state to subscribers
    this.emit();
  }

  dispose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners.clear();
  }

  getStatus(): UpdateStatus {
    return this.status;
  }

  onStatusChange(listener: (status: UpdateStatus) => void): () => void {
    this.listeners.add(listener);
    // immediate call with current
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async checkForUpdates(): Promise<{ started: boolean; reason?: string }> {
    return window.electronAPI.checkForUpdates?.() ?? { started: false, reason: 'api-missing' };
  }

  async installUpdateNow(): Promise<boolean> {
    return window.electronAPI.installUpdateNow?.() ?? false;
  }

  private translate(event: UpdateEvent | { type: 'idle' }): UpdateStatus {
    if (!event) return { type: 'idle' };
    switch (event.type) {
      case 'idle':
        return { type: 'idle' };
      case 'checking':
        return { type: 'checking' };
      case 'available':
        return { type: 'available', version: (event as any).info?.version };
      case 'not-available':
        return { type: 'not-available' };
      case 'error':
        return { type: 'error', message: (event as any).error };
      case 'download-progress':
        return { type: 'progress', percent: Math.round((event as any).progress?.percent || 0) };
      case 'downloaded':
        return { type: 'downloaded', version: (event as any).info?.version };
      default:
        return { type: 'idle' };
    }
  }

  private emit() {
    for (const listener of this.listeners) listener(this.status);
  }
}
