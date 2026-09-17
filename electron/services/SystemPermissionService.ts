import { platform } from 'os';
import { systemPreferences } from 'electron';
import isElevated from 'is-elevated';

class SystemPermissionService {
  private platform: string;
  private pollId: NodeJS.Timeout | null = null;
  private lastAccessibilityState: boolean | null = null;

  constructor() {
    this.platform = platform();
  }

  async checkPermissions() {
    switch (this.platform) {
      case 'darwin':
        return this.checkMacOSPermissions();
      case 'win32':
        return this.checkWindowsPermissions();
      default:
        return {
          id: 'none',
          name: 'none',
          isGranted: false,
        };
    }
  }

  async checkMacOSPermissions() {
    const accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false);

    const missingPermissions = [];
    if (!accessibilityGranted) {
      missingPermissions.push('accessibility');
    }

    return [
      {
        id: 'macAccessibility',
        name: 'Accessibility',
        isGranted: accessibilityGranted,
      },
    ];
  }

  /**
   * Start polling macOS Accessibility permission and invoke callback when it changes.
   * Returns an object with a stop() method to cancel polling.
   */
  startAccessibilityPolling(
    callback: (_perm: { id: string; name: string; isGranted: boolean }) => void,
    intervalMs = 15000
  ) {
    // ensure any previous poll is cleared
    this.stopAccessibilityPolling();

    try {
      const initial = systemPreferences.isTrustedAccessibilityClient(false);
      this.lastAccessibilityState = initial;
      callback({ id: 'macAccessibility', name: 'Accessibility', isGranted: initial });
    } catch (err) {
      // ignore initial read errors, set null so next successful read is treated as change
      this.lastAccessibilityState = null;
    }

    this.pollId = setInterval(() => {
      try {
        const current = systemPreferences.isTrustedAccessibilityClient(false);
        if (this.lastAccessibilityState === null || current !== this.lastAccessibilityState) {
          this.lastAccessibilityState = current;
          callback({ id: 'macAccessibility', name: 'Accessibility', isGranted: current });
        }
      } catch (e) {
        // ignore transient errors
      }
    }, intervalMs) as unknown as NodeJS.Timeout;

    return {
      stop: () => this.stopAccessibilityPolling(),
    };
  }

  stopAccessibilityPolling() {
    if (this.pollId != null) {
      clearInterval(this.pollId as any);
      this.pollId = null;
    }
  }

  async checkWindowsPermissions() {
    // Check for admin rights and UI automation access
    const isAdmin = await this.checkWindowsAdminRights();

    const missingPermissions = [];
    if (!isAdmin) missingPermissions.push('administrator');

    return [
      {
        id: 'winAdministrator',
        name: 'Administrator',
        isGranted: isAdmin,
      },
    ];
  }

  async checkWindowsAdminRights() {
    try {
      return await isElevated();
    } catch {
      return false;
    }
  }
}

export default SystemPermissionService;
