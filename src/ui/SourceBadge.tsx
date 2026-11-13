import { Cloud, Lock, Ruler, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeTone } from './Badge';

/** Where a result came from: the device, the cloud, or a deterministic pattern rule. */
export type SourceVariant = 'onDevice' | 'cloud' | 'rules';

const SOURCES: Readonly<
  Record<SourceVariant, { tone: BadgeTone; icon: LucideIcon; label: string }>
> = {
  onDevice: { tone: 'accent', icon: Lock, label: 'On your device' },
  cloud: { tone: 'cloud', icon: Cloud, label: 'Cloud' },
  rules: { tone: 'neutral', icon: Ruler, label: 'Pattern rule' },
};

export function SourceBadge(props: { readonly variant: SourceVariant }) {
  const { tone, icon, label } = SOURCES[props.variant];
  return (
    <Badge tone={tone} icon={icon}>
      {label}
    </Badge>
  );
}
