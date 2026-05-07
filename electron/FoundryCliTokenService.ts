import { execFile } from 'child_process';

interface TokenCacheEntry {
  token: string;
  expiresAtMs: number;
}

interface AzTokenResponse {
  accessToken?: string;
  access_token?: string;
  expiresOn?: string;
  expires_on?: string;
}

const REFRESH_BUFFER_MS = 2 * 60 * 1000;
const AZ_CLI_TIMEOUT_MS = 60 * 1000;
const AZ_CLI_MAX_BUFFER_BYTES = 1024 * 1024;

class FoundryCliTokenService {
  private cache = new Map<string, TokenCacheEntry>();

  async getAccessToken(scope: string): Promise<string> {
    const cached = this.cache.get(scope);
    if (cached && !this.isExpiringSoon(cached.expiresAtMs)) {
      return cached.token;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const tokenData = await this.fetchTokenFromAzureCli(scope);
        this.cache.set(scope, tokenData);
        return tokenData.token;
      } catch (error: any) {
        lastError = this.normalizeCliError(error);
      }
    }

    throw lastError || new Error('Failed to retrieve Foundry token from Azure CLI.');
  }

  private isExpiringSoon(expiresAtMs: number): boolean {
    return Date.now() + REFRESH_BUFFER_MS >= expiresAtMs;
  }

  private fetchTokenFromAzureCli(scope: string): Promise<TokenCacheEntry> {
    return new Promise((resolve, reject) => {
      execFile(
        'az',
        ['account', 'get-access-token', '--scope', scope, '--output', 'json'],
        {
          timeout: AZ_CLI_TIMEOUT_MS,
          maxBuffer: AZ_CLI_MAX_BUFFER_BYTES,
        },
        (error, stdout, stderr) => {
          if (error) {
            const isTimeoutError =
              (error as NodeJS.ErrnoException).code === 'ETIMEDOUT' ||
              /timed out/i.test(error.message || '');
            if (isTimeoutError) {
              reject(
                new Error(
                  `Azure CLI timed out after ${Math.floor(
                    AZ_CLI_TIMEOUT_MS / 1000
                  )} seconds. Check Azure CLI auth/config and try again.`
                )
              );
              return;
            }

            reject(
              new Error(stderr?.trim() || error.message || 'Azure CLI command failed unexpectedly.')
            );
            return;
          }

          try {
            const payload = JSON.parse(stdout || '{}') as AzTokenResponse;
            const token = payload.accessToken || payload.access_token;
            if (!token) {
              reject(new Error('Azure CLI did not return an access token.'));
              return;
            }

            const expiresAtMs = this.parseExpiresAt(payload);
            if (!expiresAtMs) {
              reject(new Error('Azure CLI returned an invalid token expiration timestamp.'));
              return;
            }

            resolve({ token, expiresAtMs });
          } catch (parseError: any) {
            reject(new Error(`Failed to parse Azure CLI token response: ${parseError.message}`));
          }
        }
      );
    });
  }

  private parseExpiresAt(payload: AzTokenResponse): number | null {
    if (payload.expires_on) {
      const epochSeconds = Number(payload.expires_on);
      if (!Number.isNaN(epochSeconds) && epochSeconds > 0) {
        return epochSeconds * 1000;
      }
    }

    if (payload.expiresOn) {
      const parsed = Date.parse(payload.expiresOn);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  private normalizeCliError(error: Error): Error {
    const message = error.message || '';

    if (/spawn az ENOENT/i.test(message)) {
      return new Error('Azure CLI is not installed. Install it and run `az login` first.');
    }

    if (/Please run 'az login'|az login/i.test(message)) {
      return new Error('Azure CLI is not logged in. Run `az login` and try again.');
    }

    if (/permission|denied|forbidden|unauthorized|401/i.test(message)) {
      return new Error(
        `Azure CLI token retrieved but authorization failed. Verify Foundry RBAC and scope. Details: ${message}`
      );
    }

    return new Error(`Failed to get Foundry token via Azure CLI: ${message}`);
  }
}

export default FoundryCliTokenService;
