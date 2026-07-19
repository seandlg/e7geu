export type Availability = 'yes' | 'reported' | 'limited' | 'no' | 'reported-no' | 'unknown';

export type WorkCafe = {
  id: string;
  name: string;
  district: string;
  area: string;
  address: string;
  score: 1 | 2 | 3 | 4 | 5;
  scoreBasis: 'firsthand' | 'research';
  verdict: string;
  bestFor: readonly string[];
  watchOut: string;
  evidence: string;
  features: {
    wifi: Availability;
    power: Availability;
    indoor: Availability;
    outdoor: Availability;
    toilet: Availability;
    food: Availability;
  };
  links: {
    maps: string;
    website?: string;
  };
  checked: string;
};

export type CafeFilters = {
  query: string;
  district: string;
  wifi: boolean;
  power: boolean;
  outdoor: boolean;
};

export const emptyCafeFilters: CafeFilters = {
  query: '',
  district: 'all',
  wifi: false,
  power: false,
  outdoor: false,
};

export const cafes: readonly WorkCafe[] = [
  {
    id: 'einstein-gendarmenmarkt',
    name: 'Einstein Kaffee Gendarmenmarkt',
    district: 'Mitte',
    area: 'Gendarmenmarkt',
    address: 'Markgrafenstraße 34, 10117 Berlin',
    score: 5,
    scoreBasis: 'firsthand',
    verdict:
      'A bright, dependable central option with a view that makes a work session feel less like one.',
    bestFor: ['Longer sessions', 'Winter sun', 'Central meetings'],
    watchOut:
      'Premium central-Berlin coffee prices and a busier tourist setting; quiet long stays are unverified.',
    evidence:
      'The venue, indoor/outdoor seating, and light food are officially documented. Wi-Fi is publicly reported; sockets and a customer toilet still need reconfirming.',
    features: {
      wifi: 'reported',
      power: 'unknown',
      indoor: 'yes',
      outdoor: 'yes',
      toilet: 'unknown',
      food: 'yes',
    },
    links: {
      maps: 'https://www.google.com/maps/search/?api=1&query=EINSTEIN%20KAFFEE%20Gendarmenmarkt%2C%20Markgrafenstra%C3%9Fe%2034%2C%2010117%20Berlin',
      website: 'https://einstein-kaffee.de/standorte/standorte-berlin/gendarmenmarkt/',
    },
    checked: 'July 2026',
  },
  {
    id: 'cafe-bar-kult',
    name: 'Café & Bar KULT',
    district: 'Friedrichshain-Kreuzberg',
    area: 'Friedrichshain · RAW Gelände',
    address: 'Revaler Straße 99, Tor 2/Haus 6, 10245 Berlin',
    score: 5,
    scoreBasis: 'research',
    verdict:
      'A purpose-built café, gallery, and coworking hybrid with unusually strong basics for a focused laptop session.',
    bestFor: ['Focused sessions', 'Reliable Wi-Fi', 'Outdoor work'],
    watchOut:
      'Dedicated coworking desks cost extra, the food menu is light, and events can make noise less predictable.',
    evidence:
      'KULT officially welcomes laptops and confirms fast Wi-Fi, sockets, indoor/outdoor seating, light food, and optional reservable coworking desks. A customer toilet is publicly reported.',
    features: {
      wifi: 'yes',
      power: 'yes',
      indoor: 'yes',
      outdoor: 'yes',
      toilet: 'reported',
      food: 'yes',
    },
    links: {
      maps: 'https://www.google.com/maps/place/Caf%C3%A9+%26+Bar+KULT/@52.5078716,13.4524131,16.17z/data=!3m1!5s0x47a84e5a2b0a0f81:0x7c38da2f56fcbe27!4m6!3m5!1s0x47a84fd01ba8cceb:0x4cdf980d12d1c15a!8m2!3d52.5077373!4d13.4536995!16s%2Fg%2F11rcpb8md4?entry=ttu&g_ep=EgoyMDI2MDcxNS4wIKXMDSoASAFQAw%3D%3D',
      website: 'https://www.kult-berlin.de/',
    },
    checked: 'July 2026',
  },
  {
    id: 'milch-und-zucker',
    name: 'Milch & Zucker',
    district: 'Friedrichshain-Kreuzberg',
    area: 'Friedrichshain · Frankfurter Tor',
    address: 'Warschauer Straße 70, 10243 Berlin',
    score: 4,
    scoreBasis: 'firsthand',
    verdict:
      'One of the stronger all-round work cafés in Friedrichshain, especially if you also want a proper meal.',
    bestFor: ['Laptop work', 'Cooked lunch', 'Frankfurter Tor'],
    watchOut:
      'A recent review reports a no-laptops pause from 12:00–14:00; sockets are limited and toilet queues happen.',
    evidence:
      'The venue and substantial menu are officially documented. Wi-Fi, limited sockets, toilets, outdoor seating, and the lunch laptop pause are public reports.',
    features: {
      wifi: 'reported',
      power: 'limited',
      indoor: 'yes',
      outdoor: 'yes',
      toilet: 'reported',
      food: 'yes',
    },
    links: {
      maps: 'https://www.google.com/maps/search/?api=1&query=milch%26zucker%2C%20Warschauer%20Stra%C3%9Fe%2070%2C%2010243%20Berlin',
      website: 'https://milchundzucker.eu/',
    },
    checked: 'July 2026',
  },
  {
    id: 'espresso-house-ostbahnhof',
    name: 'Espresso House Ostbahnhof',
    district: 'Friedrichshain-Kreuzberg',
    area: 'Friedrichshain · Ostbahnhof',
    address: 'Am Ostbahnhof 9, 10243 Berlin',
    score: 4,
    scoreBasis: 'firsthand',
    verdict:
      'Comfortable, predictable seating near the station with enough around it to support a practical work stop.',
    bestFor: ['Laptop work', 'Travel days', 'Comfortable seating'],
    watchOut:
      'The café is in the station hall, so foot traffic and announcements are likely. No in-café toilet is personally reported.',
    evidence:
      'Espresso House and Deutsche Bahn confirm the venue, indoor seating, Wi-Fi, and light food. Sockets and outdoor seating are unverified; no in-café toilet is a personal report.',
    features: {
      wifi: 'yes',
      power: 'unknown',
      indoor: 'yes',
      outdoor: 'unknown',
      toilet: 'reported-no',
      food: 'yes',
    },
    links: {
      maps: 'https://www.google.com/maps/search/?api=1&query=Espresso%20House%20Ostbahnhof%2C%20Am%20Ostbahnhof%209%2C%2010243%20Berlin',
      website: 'https://de.espressohouse.com/find-us/ostbahnhof',
    },
    checked: 'July 2026',
  },
] as const;

function searchableText(cafe: WorkCafe): string {
  return [
    cafe.name,
    cafe.district,
    cafe.area,
    cafe.address,
    cafe.verdict,
    cafe.watchOut,
    ...cafe.bestFor,
  ].join(' ');
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en');
}

function isAvailable(value: Availability): boolean {
  return value === 'yes' || value === 'reported' || value === 'limited';
}

export function filterCafes(collection: readonly WorkCafe[], filters: CafeFilters): WorkCafe[] {
  const terms = normalize(filters.query).trim().split(/\s+/).filter(Boolean);

  return collection
    .filter((cafe) => {
      const haystack = normalize(searchableText(cafe));
      return (
        terms.every((term) => haystack.includes(term)) &&
        (filters.district === 'all' || cafe.district === filters.district) &&
        (!filters.wifi || isAvailable(cafe.features.wifi)) &&
        (!filters.power || isAvailable(cafe.features.power)) &&
        (!filters.outdoor || isAvailable(cafe.features.outdoor))
      );
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function cafeDistricts(collection: readonly WorkCafe[]): string[] {
  return [...new Set(collection.map((cafe) => cafe.district))].sort((a, b) => a.localeCompare(b));
}

export function activeFilterCount(filters: CafeFilters): number {
  return (
    Number(filters.query.trim().length > 0) +
    Number(filters.district !== 'all') +
    Number(filters.wifi) +
    Number(filters.power) +
    Number(filters.outdoor)
  );
}
