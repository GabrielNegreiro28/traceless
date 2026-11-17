import type { ScanPipelineSpec } from '../ai/prompts/scanPipelines';
import type { ConfigService } from '../application/ports/ConfigService';
import type { ConsentedIdentityScanner } from '../application/ports/ConsentedIdentityScanner';
import { scanWithCloudConsent } from '../application/usecases/scanWithCloudConsent';
import { ConsentedCloudIdentityScanner } from '../infrastructure/ai/adapters/ConsentedCloudIdentityScanner';
import { consentedScanModelSpec } from '../infrastructure/ai/adapters/consentedScanModelSpec';
import { getAiService } from '../infrastructure/ai/aiService';
import { createConsentedCloudModel } from '../infrastructure/ai/consentedCloudModel';
import { createConsentedCloudRunner } from '../infrastructure/ai/consentedCloudRunner';
import { systemClock } from '../infrastructure/clock/systemClock';
import { createRemoteConfigService } from '../infrastructure/config/RemoteConfigService';
import type { AppEnv } from './env';
import { bootstrapFirebase } from './firebaseBootstrap';
import type { ScanSetup } from './scanBinding';
import type { CloudScanService } from './servicesContract';

/**
 * Part of the composition root: the consented cloud scan (design plan §2b) and Remote Config
 * (real AI mode). Firebase is only touched on first use, never while building the services.
 */

/** The consented cloud scanner for one scan pass (CONSENTED_CLOUD_SCAN_PASS in the product). */
export function createConsentedCloudScanner(
  env: AppEnv,
  { groups, prompt }: ScanSetup,
): ConsentedIdentityScanner {
  return new ConsentedCloudIdentityScanner(
    groups,
    (group) =>
      createConsentedCloudRunner(() =>
        createConsentedCloudModel(
          getAiService(bootstrapFirebase(env)),
          consentedScanModelSpec(group, prompt),
        ),
      ),
    prompt.parse,
  );
}

export function createConfigService(env: AppEnv): ConfigService {
  return createRemoteConfigService(() => bootstrapFirebase(env));
}

/** What the cloud scan shares with the on-device scan of the same variant. */
export type CloudScanSettings = Pick<ScanPipelineSpec, 'chunkChars' | 'postFilters' | 'rulePack'>;

/** Binds the consented scan use case to its scanner, the kill switch and the variant. */
export function bindCloudScan(
  scanner: ConsentedIdentityScanner,
  config: ConfigService,
  settings: CloudScanSettings,
): CloudScanService {
  return (text, consent, onProgress, isCancelled) =>
    scanWithCloudConsent(
      text,
      consent,
      { scanner, config, clock: systemClock, ...settings },
      {
        ...(onProgress === undefined ? {} : { onProgress }),
        ...(isCancelled === undefined ? {} : { isCancelled }),
      },
    );
}
