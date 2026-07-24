import type { ToolboxApp } from '$lib/apps/catalog';

export type AppHref = ToolboxApp['href'];

const RECENT_APP_LIMIT = 3;

export function parseRecentAppHrefs(
  stored: string | null,
  apps: readonly ToolboxApp[],
): readonly AppHref[] {
  if (!stored) return [];

  try {
    const value: unknown = JSON.parse(stored);
    if (!Array.isArray(value)) return [];

    const knownHrefs = new Set<AppHref>(apps.map((app) => app.href));
    return value
      .filter(
        (href): href is AppHref => typeof href === 'string' && knownHrefs.has(href as AppHref),
      )
      .filter((href, index, hrefs) => hrefs.indexOf(href) === index)
      .slice(0, RECENT_APP_LIMIT);
  } catch {
    return [];
  }
}

export function addRecentApp(recentHrefs: readonly AppHref[], href: AppHref): readonly AppHref[] {
  return [href, ...recentHrefs.filter((recentHref) => recentHref !== href)].slice(
    0,
    RECENT_APP_LIMIT,
  );
}

export function resolveRecentApps(
  apps: readonly ToolboxApp[],
  recentHrefs: readonly AppHref[],
): readonly ToolboxApp[] {
  const appsByHref = new Map(apps.map((app) => [app.href, app]));
  return recentHrefs.flatMap((href) => {
    const app = appsByHref.get(href);
    return app ? [app] : [];
  });
}
