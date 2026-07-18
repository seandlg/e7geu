export type QrHistoryItem = {
  id: string;
  type: 'scan' | 'generate';
  value: string;
  timestamp: number;
};

export function addQrHistory(
  items: readonly QrHistoryItem[],
  item: QrHistoryItem,
  limit = 50,
): QrHistoryItem[] {
  const withoutDuplicate = items.filter(
    (existing) => !(existing.type === item.type && existing.value === item.value),
  );
  return [item, ...withoutDuplicate].slice(0, limit);
}

export function parseQrHistory(value: string | null): QrHistoryItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryItem).slice(0, 50);
  } catch {
    return [];
  }
}

function isHistoryItem(value: unknown): value is QrHistoryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    (item.type === 'scan' || item.type === 'generate') &&
    typeof item.value === 'string' &&
    typeof item.timestamp === 'number'
  );
}
