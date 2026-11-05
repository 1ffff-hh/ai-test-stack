/* 进后台的集合。键名必须和 data/*.json 的文件名、以及 build.js 里的校验一一对应。 */
export const COLLECTIONS = {
  tools: { label: '工具', file: 'data/tools.json' },
  plans: { label: '套餐', file: 'data/plans.json' },
  bundles: { label: '组合', file: 'data/bundles.json' },
} as const;

export type CollectionKey = keyof typeof COLLECTIONS;

export function isCollection(x: string): x is CollectionKey {
  return Object.prototype.hasOwnProperty.call(COLLECTIONS, x);
}

export const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[];
