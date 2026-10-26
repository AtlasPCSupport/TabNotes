import { describe, expect, it } from 'vitest';
import {
  floatingDomainFromUrl,
  floatingPermissionOrigins,
  normalizeFloatingAction,
  normalizeFloatingDomains,
} from './floating';

describe('floating button helpers', () => {
  it('accepts only normal http(s) page hosts', () => {
    expect(floatingDomainFromUrl('https://www.example.com/article')).toBe('www.example.com');
    expect(floatingDomainFromUrl('chrome://settings')).toBeNull();
    expect(floatingDomainFromUrl('data:text/html,hello')).toBeNull();
  });

  it('accepts clip destinations for the floating capture menu', () => {
    expect(normalizeFloatingAction('clip-current')).toBe('clip-current');
    expect(normalizeFloatingAction('clip-new')).toBe('clip-new');
  });

  it('creates both secure and non-secure optional origins for a host', () => {
    expect(floatingPermissionOrigins('example.com')).toEqual([
      'https://example.com/*',
      'http://example.com/*',
    ]);
  });

  it('rejects unknown floating actions at the message boundary', () => {
    expect(normalizeFloatingAction('screenshot-new')).toBe('screenshot-new');
    expect(normalizeFloatingAction('delete-all')).toBeNull();
  });

  it('normalizes enabled domains without duplicates', () => {
    expect(normalizeFloatingDomains(['Example.com', 'example.com.', 'bad/domain', 4])).toEqual([
      'example.com',
    ]);
  });
});
