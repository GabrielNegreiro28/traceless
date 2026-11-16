import {
  DEFAULT_APP_CONFIG,
  type AppConfig,
  type ConfigService,
} from '../../application/ports/ConfigService';

/** Deterministic ConfigService for tests, E2E and demo mode: no Firebase, no network. */
export class FakeConfigService implements ConfigService {
  loads = 0;
  private config: AppConfig;

  constructor(config: Partial<AppConfig> = {}) {
    this.config = { ...DEFAULT_APP_CONFIG, ...config };
  }

  /** Flips a value, as a Remote Config update would between two loads. */
  set(config: Partial<AppConfig>): void {
    this.config = { ...this.config, ...config };
  }

  load(): Promise<AppConfig> {
    this.loads += 1;
    return Promise.resolve(this.config);
  }
}
