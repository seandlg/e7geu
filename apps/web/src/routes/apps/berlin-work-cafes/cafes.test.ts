import { describe, expect, it } from 'vite-plus/test';
import { activeFilterCount, cafeDistricts, cafes, emptyCafeFilters, filterCafes } from './cafes';

describe('filterCafes', () => {
  it('returns cafés by score and then name by default', () => {
    expect(filterCafes(cafes, emptyCafeFilters).map((cafe) => cafe.id)).toEqual([
      'cafe-bar-kult',
      'einstein-gendarmenmarkt',
      'espresso-house-ostbahnhof',
      'milch-und-zucker',
    ]);
  });

  it('searches names, areas, verdicts, and use cases without diacritics', () => {
    expect(filterCafes(cafes, { ...emptyCafeFilters, query: 'RAW reliable' })[0]?.id).toBe(
      'cafe-bar-kult',
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
    expect(results.map((cafe) => cafe.id)).toEqual(['cafe-bar-kult', 'milch-und-zucker']);
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
    expect(cafeDistricts(cafes)).toEqual(['Friedrichshain-Kreuzberg', 'Mitte']);
  });

  it('keeps researched scores distinct from firsthand assessments', () => {
    expect(cafes.find((cafe) => cafe.id === 'cafe-bar-kult')?.scoreBasis).toBe('research');
    expect(cafes.some((cafe) => cafe.id === 'haferkater-eberswalder')).toBe(false);
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
