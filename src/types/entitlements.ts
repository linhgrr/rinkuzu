export type Tier = 'free' | 'premium';
export type BooleanCapability = 'premium_catalog';
export type EntitlementConstraint = 'quiz_pdf_pages' | 'adaptive_pdf_pages' | 'pdf_upload_bytes';
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
  constraints: Record<EntitlementConstraint, number>;
}
