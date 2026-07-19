import { describe, expect, it } from 'vite-plus/test';
import { activeFilterCount, cafeDistricts, cafes, emptyCafeFilters, filterCafes } from './cafes';

describe('filterCafes', () => {
  it('returns cafés by score and then name by default', () => {
    expect(filterCafes(cafes, emptyCafeFilters).map((cafe) => cafe.id)).toEqual([
      'einstein-gendarmenmarkt',
      'haferkater-eberswalder',
      'espresso-house-ostbahnhof',
      'milch-und-zucker',
    ]);
  });

  it('searches names, areas, verdicts, and use cases without diacritics', () => {
    expect(filterCafes(cafes, { ...emptyCafeFilters, query: 'Eberswalder Straße' })).toHaveLength(
      1,
    );
    expect(filterCafes(cafes, { ...emptyCafeFilters, query: 'Frankfurter laptop' })[0]?.id).toBe(
      'milch-und-zucker',
    );
  });

  it('combines district and practical feature filters', () => {
    const results = filterCafes(cafes, {
      ...emptyCafeFilters,
      district: 'Friedrichshain-Kreuzberg',
      power: true,
    });
    expect(results.map((cafe) => cafe.id)).toEqual(['milch-und-zucker']);
  });

  it('treats limited availability as useful and excludes unavailable features', () => {
    expect(
      filterCafes(cafes, { ...emptyCafeFilters, power: true }).some(
        (cafe) => cafe.id === 'milch-und-zucker',
      ),
    ).toBe(true);
  });
});

describe('filter helpers', () => {
  it('returns unique sorted districts', () => {
    expect(cafeDistricts(cafes)).toEqual(['Friedrichshain-Kreuzberg', 'Mitte', 'Pankow']);
  });

  it('counts active controls while ignoring whitespace-only search', () => {
    expect(activeFilterCount(emptyCafeFilters)).toBe(0);
    expect(
      activeFilterCount({
        ...emptyCafeFilters,
        query: '  ',
        wifi: true,
        outdoor: true,
        district: 'Mitte',
      }),
    ).toBe(3);
  });
});
