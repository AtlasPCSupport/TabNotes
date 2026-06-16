import { describe, expect, it } from 'vitest';
import { hasFeature } from './entitlements';

describe('hasFeature', () => {
  it('allows launch-free features before licensing is enforced', () => {
    expect(hasFeature('drive_sync', { mode: 'launch_free' })).toBe(true);
  });

  it('requires an active pro license once license mode is enabled', () => {
    expect(
      hasFeature('drive_sync', {
        mode: 'license',
        plan: 'pro',
        licenseStatus: 'active',
        features: ['drive_sync'],
      }),
    ).toBe(true);

    expect(
      hasFeature('drive_sync', {
        mode: 'license',
        plan: 'free',
        licenseStatus: 'none',
        features: [],
      }),
    ).toBe(false);
  });
});
