import type { ToolboxApp } from '$lib/apps/catalog';

export function searchApps(apps: readonly ToolboxApp[], query: string): readonly ToolboxApp[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return apps;

  return apps.filter((app) => {
    const searchable = `${app.name} ${app.description} ${app.capability}`.toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
