export type Tier = 'free' | 'premium';
export type BooleanCapability = 'private_quiz';
export type EntitlementConstraint = 'adaptive_pdf_pages';
export type MeteredCapability =
  | 'ask_rin_chan'
  | 'quiz_extract'
  | 'adaptive_pipeline'
  | 'adaptive_generation';
export type RateWindow = 'minute' | 'day' | 'month';
type Capability = BooleanCapability | MeteredCapability;

export interface Entitlements {
  tier: Tier;
}

export interface EntitlementWindowSnapshot {
  window: RateWindow;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

type CapabilitySnapshot =
  | { kind: 'boolean'; enabled: boolean }
  | {
      kind: 'metered';
      enabled: boolean;
      unmetered?: boolean;
      windows: EntitlementWindowSnapshot[];
    };

export interface EntitlementSnapshot {
  tier: Tier;
  capabilities: Record<Capability, CapabilitySnapshot>;
}
