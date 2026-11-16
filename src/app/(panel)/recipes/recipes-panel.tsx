'use client'

import { useMemo, useState, useTransition } from 'react'
import { deleteRecipeAction, saveRecipeAction } from '@/app/actions/recipes'
import { Alert, btnGhost, btnPrimary, labelClass } from '@/components/erp-ui'
import { DataTable, SectionCard, type DataTableColumn } from '@/components/ui'
import { formatPct } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import type { RecipeCostRow } from '@/services/recipe.service'

type ProductOpt = { id: string; code: string; name: string; sellingPrice: number; costPrice: number }
type LineDraft = { ingredientProductId: string; quantity: string; unit: string; wastagePercent: string }

const inputCls =
  'ds-surface-subtle ds-focus-ring w-full rounded-xl px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'

export function RecipesPanel({
  rows,
  products,
  brands,
  canCreate,
  canEdit,
  canDelete,
}: {
  rows: RecipeCostRow[]
  products: ProductOpt[]
  brands: Array<{ id: string; nameAr: string; nameEn: string }>
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const { t, locale } = useI18n()
  const isEn = locale === 'en'
  const uiLocale = isEn ? 'en' : 'ar'
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>()
  const [menuProductId, setMenuProductId] = useState(products[0]?.id ?? '')
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [brandCode, setBrandCode] = useState('')
  const [wastagePercent, setWastagePercent] = useState('3')
  const [targetFoodCostPercent, setTarget] = useState('32')
  const [lines, setLines] = useState<LineDraft[]>([
    { ingredientProductId: products[1]?.id || products[0]?.id || '', quantity: '100', unit: 'g', wastagePercent: '5' },
  ])

  const menuOptions = useMemo(() => products, [products])

  function resetForm() {
    setEditingId(undefined)
    setName('')
    setNameEn('')
    setBrandCode('')
    setWastagePercent('3')
    setTarget('32')
    setMenuProductId(products[0]?.id ?? '')
    setLines([{ ingredientProductId: products[1]?.id || products[0]?.id || '', quantity: '100', unit: 'g', wastagePercent: '5' }])
  }

  function submit() {
    setError('')
    setNotice('')
    start(async () => {
      const result = await saveRecipeAction({
        id: editingId,
        menuProductId,
        name,
        nameEn,
        brandCode: brandCode || undefined,
        wastagePercent: Number(wastagePercent) || 0,
        targetFoodCostPercent: Number(targetFoodCostPercent) || 32,
        lines: lines.map((line) => ({
          ingredientProductId: line.ingredientProductId,
          quantity: Number(line.quantity),
          unit: line.unit,
          wastagePercent: Number(line.wastagePercent) || 0,
        })),
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      setNotice(isEn ? 'Recipe saved' : 'تم حفظ الوصفة')
      resetForm()
    })
  }

  const columns: ReadonlyArray<DataTableColumn<RecipeCostRow>> = [
    {
      key: 'recipe',
      header: isEn ? 'Recipe' : 'الوصفة',
      render: (row) => (
        <div>
          <p className="font-semibold" style={{ color: 'var(--ds-text-primary)' }}>
            {isEn && row.nameEn ? row.nameEn : row.name}
          </p>
          <p className="text-xs" style={{ color: 'var(--ds-text-muted)' }}>
            {row.menuName} ·{' '}
            <span dir="ltr" className="ds-num font-mono">
              {row.menuCode}
            </span>
          </p>
        </div>
      ),
    },
    {
      key: 'sellingPrice',
      header: isEn ? 'Sell' : 'البيع',
      format: 'kwd',
      align: 'numeric',
      accessor: (row) => row.sellingPrice,
    },
    {
      key: 'ingredientCost',
      header: isEn ? 'Food cost' : 'تكلفة الغذاء',
      format: 'kwd',
      align: 'numeric',
      accessor: (row) => row.ingredientCost,
    },
    {
      key: 'foodCostPercent',
      header: isEn ? 'Food Cost %' : 'نسبة تكلفة الغذاء %',
      align: 'numeric',
      render: (row) => (
        <span
          className="font-bold"
          style={{ color: row.overTarget ? 'var(--ds-negative)' : 'var(--ds-positive)' }}
        >
          {formatPct(row.foodCostPercent, { locale: uiLocale })}
          {row.overTarget
            ? ` > ${formatPct(row.targetFoodCostPercent, { locale: uiLocale, decimals: 0 })}`
            : ''}
        </span>
      ),
    },
    {
      key: 'marginPercent',
      header: isEn ? 'Margin' : 'الهامش',
      format: 'pct',
      align: 'numeric',
      accessor: (row) => row.marginPercent,
    },
    {
      key: 'actions',
      header: isEn ? 'Actions' : 'إجراءات',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <button
              type="button"
              className={`${btnGhost} ds-focus-ring min-h-9`}
              onClick={() => {
                setEditingId(row.id)
                setMenuProductId(row.menuProductId)
                setName(row.name)
                setNameEn(row.nameEn)
                setBrandCode(row.brandCode || '')
                setTarget(String(row.targetFoodCostPercent))
              }}
            >
              {t('action.edit')}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className={`${btnGhost} ds-focus-ring min-h-9`}
              onClick={() =>
                start(async () => {
                  const result = await deleteRecipeAction(row.id)
                  if (!result.ok) setError(result.message)
                })
              }
            >
              {t('action.delete')}
            </button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="ok">{notice}</Alert> : null}

      {(canCreate || canEdit) && (
        <SectionCard
          locale={uiLocale}
          title={`${editingId ? t('action.edit') : t('action.add')} · ${
            isEn ? 'BOM' : 'بطاقة الوصفة والمكونات المعيارية'
          }`}
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label htmlFor="recipe-menu-item" className={labelClass}>
                  {isEn ? 'Menu item' : 'صنف المنيو'}
                </label>
                <select
                  id="recipe-menu-item"
                  className={inputCls}
                  value={menuProductId}
                  onChange={(e) => setMenuProductId(e.target.value)}
                >
                  {menuOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="recipe-name-ar" className={labelClass}>
                  {isEn ? 'Recipe name (AR)' : 'اسم الوصفة'}
                </label>
                <input id="recipe-name-ar" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label htmlFor="recipe-name-en" className={labelClass}>
                  {isEn ? 'Recipe name (EN)' : 'الاسم بالإنجليزية'}
                </label>
                <input
                  id="recipe-name-en"
                  className={inputCls}
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div>
                <label htmlFor="recipe-brand" className={labelClass}>
                  {isEn ? 'Brand' : 'البراند'}
                </label>
                <select
                  id="recipe-brand"
                  className={inputCls}
                  value={brandCode}
                  onChange={(e) => setBrandCode(e.target.value)}
                >
                  <option value="">{isEn ? 'All brands' : 'كل البراندات'}</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {isEn ? b.nameEn : b.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="recipe-wastage" className={labelClass}>
                  {isEn ? 'Recipe wastage %' : 'هدر الوصفة %'}
                </label>
                <input
                  id="recipe-wastage"
                  className={inputCls}
                  dir="ltr"
                  value={wastagePercent}
                  onChange={(e) => setWastagePercent(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="recipe-target-fc" className={labelClass}>
                  {isEn ? 'Target food cost %' : 'هدف تكلفة الغذاء %'}
                </label>
                <input
                  id="recipe-target-fc"
                  className={inputCls}
                  dir="ltr"
                  value={targetFoodCostPercent}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--ds-text-secondary)' }}>
                {isEn ? 'Ingredients' : 'المكونات الخام'}
              </p>
              {lines.map((line, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-5">
                  <select
                    aria-label={isEn ? `Ingredient ${index + 1}` : `مكوّن ${index + 1}`}
                    className={`${inputCls} md:col-span-2`}
                    value={line.ingredientProductId}
                    onChange={(e) => {
                      const next = [...lines]
                      next[index] = { ...line, ingredientProductId: e.target.value }
                      setLines(next)
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={isEn ? `Ingredient quantity ${index + 1}` : `كمية المكوّن ${index + 1}`}
                    className={inputCls}
                    dir="ltr"
                    placeholder={isEn ? 'Qty' : 'الكمية'}
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...lines]
                      next[index] = { ...line, quantity: e.target.value }
                      setLines(next)
                    }}
                  />
                  <select
                    aria-label={isEn ? `Ingredient unit ${index + 1}` : `وحدة المكوّن ${index + 1}`}
                    className={inputCls}
                    value={line.unit}
                    onChange={(e) => {
                      const next = [...lines]
                      next[index] = { ...line, unit: e.target.value }
                      setLines(next)
                    }}
                  >
                    <option value="g">{isEn ? 'g' : 'غرام'}</option>
                    <option value="ml">{isEn ? 'ml' : 'مل'}</option>
                    <option value="pc">{isEn ? 'pc' : 'حبة'}</option>
                  </select>
                  <input
                    aria-label={isEn ? `Ingredient waste % ${index + 1}` : `نسبة الهدر ${index + 1}`}
                    className={inputCls}
                    dir="ltr"
                    placeholder={isEn ? 'Waste %' : 'الهدر %'}
                    value={line.wastagePercent}
                    onChange={(e) => {
                      const next = [...lines]
                      next[index] = { ...line, wastagePercent: e.target.value }
                      setLines(next)
                    }}
                  />
                </div>
              ))}
              <button
                type="button"
                className={`${btnGhost} ds-focus-ring min-h-10`}
                onClick={() =>
                  setLines((current) => [
                    ...current,
                    { ingredientProductId: products[0]?.id || '', quantity: '10', unit: 'g', wastagePercent: '0' },
                  ])
                }
              >
                + {isEn ? 'Ingredient' : 'مكوّن'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${btnPrimary} ds-focus-ring min-h-10`}
                disabled={pending || (!canCreate && !editingId)}
                onClick={submit}
              >
                {pending ? '…' : t('action.save')}
              </button>
              {editingId ? (
                <button type="button" className={`${btnGhost} ds-focus-ring min-h-10`} onClick={resetForm}>
                  {t('action.cancel')}
                </button>
              ) : null}
            </div>
          </div>
        </SectionCard>
      )}

      <DataTable<RecipeCostRow>
        locale={uiLocale}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle={isEn ? 'No recipes yet.' : 'لا توجد وصفات بعد.'}
        emptyDescription={
          isEn
            ? 'Add a standard BOM recipe above to calculate food-cost % and margin.'
            : 'أضف بطاقة وصفة معيارية أعلاه لحساب تكلفة الغذاء والهامش.'
        }
      />
    </div>
  )
}
