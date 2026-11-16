import { CheckOptionsScreen, type CheckOptionsScreenProps } from './CheckOptionsScreen';
import { useCloudScanAvailability } from './useCloudScanAvailability';

/** Container: reads the cloud kill switch, then renders the presentational options screen. */
export function CheckOptions(props: Omit<CheckOptionsScreenProps, 'cloud'>) {
  const cloud = useCloudScanAvailability();
  return <CheckOptionsScreen {...props} cloud={cloud} />;
}
