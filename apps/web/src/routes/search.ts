import { appCategories, type ToolboxApp } from '../lib/apps/catalog.ts';

export function searchApps(apps: readonly ToolboxApp[], query: string): readonly ToolboxApp[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return apps;

  return apps.filter((app) => {
    const category = appCategories.find(({ id }) => id === app.category);
    const searchable =
      `${app.name} ${app.description} ${app.capability} ${category?.label ?? ''}`.toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
