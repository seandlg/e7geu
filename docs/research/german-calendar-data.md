# German calendar data: school and public holidays

Research date: 2026-07-21. Sources are official government pages, the API's
first-party documentation and source repositories, and direct HTTP checks
against the live API.

## Recommendation

Use [OpenHolidays API](https://www.openholidaysapi.org/en/) for both German
school holidays and public holidays. It is the simplest fit for a stateless,
browser-only app because it needs no key, returns JSON, uses ISO 3166-2 Land
codes, and exposes both datasets through the same response model. Its Germany
source register links the BMI, the holiday law of every Land, the KMK, and all
16 Land education authorities; it is therefore an aggregator rather than an
official German-government API, but its provenance is unusually transparent.
([Germany source register](https://www.openholidaysapi.org/en/sources-europe/#germany),
[raw-data repository](https://github.com/openpotato/openholidaysapi.data))

Fetch one calendar year at a time, cache the last successful response locally,
and keep rendering cached data when the network is unavailable. The API accepts
at most 1,095 days per request, so annual requests are also less error-prone
than a single multi-year request. The documentation supports JSON and iCalendar
and describes both public- and school-holiday queries as accepting arbitrary
ranges up to three years.
([API introduction and examples](https://www.openholidaysapi.org/en/),
[OpenAPI entry point](https://www.openholidaysapi.org/en/api/))

## Endpoints and response shape

Recommended calls (query values must be URL-encoded):

```text
GET https://openholidaysapi.org/Subdivisions?countryIsoCode=DE&languageIsoCode=EN

GET https://openholidaysapi.org/SchoolHolidays
    ?countryIsoCode=DE
    &languageIsoCode=DE
    &validFrom=2029-01-01
    &validTo=2029-12-31

GET https://openholidaysapi.org/PublicHolidays
    ?countryIsoCode=DE
    &languageIsoCode=DE
    &validFrom=2029-01-01
    &validTo=2029-12-31
```

An optional `subdivisionCode=DE-BE` restricts either holiday query to one Land.
For this product, fetching all Germany and filtering locally is preferable: it
supports instant search/toggles and overlap calculation without 16 requests.
The live `Subdivisions` call returned exactly the 16 Länder, with fields such as
`code`, `shortName`, localized `name`, and `officialLanguages`.
([live subdivision response](https://openholidaysapi.org/Subdivisions?countryIsoCode=DE&languageIsoCode=EN),
[interactive API specification](https://openholidaysapi.org/swagger/index.html))

Holiday records observed in the live JSON contain:

```text
id, startDate, endDate, type, name[{language,text}], regionalScope,
temporalScope, nationwide, subdivisions?[{code,shortName}]
```

`startDate` and `endDate` are inclusive civil dates. A returned interval that
intersects the requested range can begin before `validFrom` or end after
`validTo`; when annual requests are combined, deduplicate by `id`. Keep these
values as date-only strings (or explicit calendar-date objects) rather than
parsing them as UTC instants.
([live 2029 school-holiday response](https://openholidaysapi.org/SchoolHolidays?countryIsoCode=DE&languageIsoCode=DE&validFrom=2029-01-01&validTo=2029-12-31),
[live 2029 public-holiday response](https://openholidaysapi.org/PublicHolidays?countryIsoCode=DE&languageIsoCode=DE&validFrom=2029-01-01&validTo=2029-12-31))

For public holidays, include records where `nationwide` is true plus records
whose `subdivisions` contain the selected Land. Preserve `regionalScope` in the
UI: the feed also contains local holidays such as Augsburg's Peace Festival,
which must not be presented as applying throughout Bavaria. Bavaria's Assumption
Day is another inherent edge case because it applies only in qualifying
municipalities even though the feed scopes it to `DE-BY`; a short
“regional/local exceptions may apply” note is prudent.

## Verified coverage and browser compatibility

Direct live checks on 2026-07-21 returned all 16 Land codes in every annual
school-holiday response from 2026 through 2029:

| Year | Holiday intervals | Distinct Land codes |
| ---: | ----------------: | ------------------: |
| 2026 |               121 |                  16 |
| 2027 |               122 |                  16 |
| 2028 |               119 |                  16 |
| 2029 |               130 |                  16 |

The live 2029 public-holiday request returned nationwide, state-specific, and
local records. The data project says Germany has public- and school-holiday
data from 2012, and its data changelog is maintained independently of the API
software.
([raw-data coverage](https://github.com/openpotato/openholidaysapi.data),
[data changelog](https://www.openholidaysapi.org/en/change-log-data/))

Requests sent with `Origin: https://e7g.eu` returned
`Access-Control-Allow-Origin: *`; successful JSON responses and validation
errors both carried the header. This confirms the live service is callable
directly from the browser. No authentication was required. Treat that as an
observed deployment property and retain a graceful offline/error state because
the app does not control the service.

## Official-source baseline

The KMK explains that it coordinates long-term summer dates while each Land
sets the other holidays and sends them to the KMK. Its current page publishes
complete school-year tables through 2028/29, summer dates through 2030, and
per-Land `.ics` downloads for the displayed school year.
([KMK holiday rules and downloads](https://www.kmk.org/service/ferienregelung.html),
[KMK calendar](https://www.kmk.org/service/ferienregelung/ferienkalender.html))

These are excellent verification sources, but not a good runtime integration:
there is no documented stable JSON API, the `.ics` links are split by Land and
school year, and non-summer dates beyond the currently published years remain
the responsibility of the Länder. OpenHolidays already consolidates the KMK
and individual Land sources into a uniform API.

For public holidays, there is likewise no single official federal data API:
the OpenHolidays source register correctly notes that only German Unity Day is
federal law and links the separate holiday laws of all 16 Länder.
([OpenHolidays Germany sources](https://www.openholidaysapi.org/en/sources-europe/#germany))

## Overlap calculation

No additional API is needed. Given the selected Land codes, expand or sweep the
inclusive holiday intervals and compute, for each date, the set of Länder whose
school holiday contains that date. Display dates where the set size is at least
two, or where it equals the number of selected Länder for a strict “all
selected overlap” mode. Coalesce adjacent dates with the same Land set into one
display range. This is small, deterministic domain logic and should be tested
independently of `fetch`.

Filtering and overlap should use `subdivisions[].code`, not translated Land
names. Search can match a local static list of English Land names while the
codes remain stable identifiers.

## License and attribution

The API FAQ permits free and commercial use and licenses the processed data
under ODbL 1.0. The raw-data repository carries the same license; the API
software itself is AGPL-3.0, which matters only if the service is copied or
self-hosted, not when its HTTP API is consumed.
([OpenHolidays FAQ](https://www.openholidaysapi.org/en/faq/),
[data repository license](https://github.com/openpotato/openholidaysapi.data),
[service source](https://github.com/openpotato/openholidaysapi))

Add a visible source line near the calendar or in its information panel, for
example: “Holiday data: OpenHolidays API — ODbL 1.0,” linking both the provider
and license. ODbL requires attribution for public use and for works produced
from the database. If the app later distributes a modified database rather
than merely presenting queried results, its share-alike and machine-readable
access provisions need a fresh review.
([ODbL summary](https://opendatacommons.org/licenses/odbl/summary/),
[ODbL 1.0 full text](https://opendatacommons.org/licenses/odbl/1-0/))

## Alternative considered

[Nager.Date](https://date.nager.at/de/api) is a credible, CORS-enabled,
open-source public-holiday API with German subdivision information, but it does
not supply the required German school-holiday dataset. Using it alongside a
second provider would add reconciliation and failure modes without improving
the initial product. Keep it only as a possible public-holiday fallback, not as
the primary integration.
