export const ENTITLEMENTS_STORAGE_KEY = 'tn_entitlements';

export type PaidFeature = 'drive_sync';
export type EntitlementMode = 'launch_free' | 'license';
export type LicenseStatus = 'none' | 'active' | 'expired' | 'invalid' | 'grace';

export interface EntitlementState {
  mode: EntitlementMode;
  plan: 'free' | 'pro';
  features: PaidFeature[];
  licenseStatus: LicenseStatus;
  checkedAt?: number;
  validUntil?: number;
}

export const DEFAULT_ENTITLEMENTS: EntitlementState = {
  mode: 'launch_free',
  plan: 'free',
  features: [],
  licenseStatus: 'none',
};

export function normalizeEntitlements(raw: Partial<EntitlementState> | null | undefined): EntitlementState {
  return {
    ...DEFAULT_ENTITLEMENTS,
    ...(raw ?? {}),
    features: Array.isArray(raw?.features) ? raw.features : DEFAULT_ENTITLEMENTS.features,
  };
}

export function hasFeature(
  feature: PaidFeature,
  raw: Partial<EntitlementState> | null | undefined = DEFAULT_ENTITLEMENTS,
  now = Date.now(),
): boolean {
  const state = normalizeEntitlements(raw);
  if (state.mode === 'launch_free') return true;
  if (state.plan !== 'pro') return false;
  if (state.validUntil && state.validUntil < now) return state.licenseStatus === 'grace';
  return state.licenseStatus === 'active' && state.features.includes(feature);
}
