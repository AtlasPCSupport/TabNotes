import { describe, expect, it } from 'vitest';
import enKeys from './locales/en.json';
import esKeys from './locales/es.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(getNestedKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

describe('i18n Locales Key Parity', () => {
  it('should have exact same keys in en.json and es.json', () => {
    const en = getNestedKeys(enKeys);
    const es = getNestedKeys(esKeys);

    const missingInEs = en.filter((k) => !es.includes(k));
    const extraInEs = es.filter((k) => !en.includes(k));

    expect(missingInEs, `Keys in en.json missing in es.json: ${missingInEs.join(', ')}`).toEqual([]);
    expect(extraInEs, `Keys in es.json missing in en.json: ${extraInEs.join(', ')}`).toEqual([]);
  });
});
