export type {
  ColdUnit,
  FoodSafetyBoard,
  ShelfLifeBatch,
  SpoilageDisposal,
  ShiftCheckIn,
  VisionVerdict,
  ShelfLifeStatus,
  SpoilageReason,
} from '@/modules/food-safety/domain/types'
export { SCRAP_ACCOUNT_CODE, PREP_CATALOG, COLD_UNIT_SPECS, MAINTENANCE_CONTACT } from '@/modules/food-safety/domain/catalog'
export { classifyShelfLife, computeScrapLossMinor, formatKwdMinor } from '@/modules/food-safety/domain/shelf-life'
export {
  SHELF_LIFE_MATRIX,
  getShelfLifeRule,
  listShelfLifeRules,
  countdownParts,
  formatKuwaitStamp,
  storageModeLabel,
  categoryLabel,
  brandScopeLabel,
  defaultStorageMode,
  resolveShelfHours,
  type StorageMode,
  type ShelfLifeRule,
  type BrandScope,
  type ShelfCategory,
} from '@/lib/food-safety/shelf-life-matrix'
