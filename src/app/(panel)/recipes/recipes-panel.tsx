'use client'

import { useMemo, useState, useTransition } from 'react'
import { deleteRecipeAction, saveRecipeAction } from '@/app/actions/recipes'
import { Alert, btnGhost, btnPrimary, cardClass, fieldClass, labelClass } from '@/components/erp-ui'
import { useI18n } from '@/lib/i18n'
import type { RecipeCostRow } from '@/services/recipe.service'

type ProductOpt = { id: string; code: string; name: string; sellingPrice: number; costPrice: number }
type LineDraft = { ingredientProductId: string; quantity: string; unit: string; wastagePercent: string }

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
  const { t, money, locale } = useI18n()
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
      setNotice(locale === 'en' ? 'Recipe saved' : 'تم حفظ الوصفة')
      resetForm()
    })
  }

  return (
    <div className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {notice ? <Alert kind="ok">{notice}</Alert> : null}

      {(canCreate || canEdit) && (
        <section className={`${cardClass} space-y-3 p-5`}>
          <h2 className="font-bold text-mist-100">{editingId ? t('action.edit') : t('action.add')} · BOM</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className={labelClass}>{locale === 'en' ? 'Menu item' : 'صنف المنيو'}</label>
              <select className={fieldClass} value={menuProductId} onChange={(e) => setMenuProductId(e.target.value)}>
                {menuOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{locale === 'en' ? 'Recipe name (AR)' : 'اسم الوصفة'}</label>
              <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{locale === 'en' ? 'Recipe name (EN)' : 'الاسم بالإنجليزية'}</label>
              <input className={fieldClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" />
            </div>
            <div>
              <label className={labelClass}>{locale === 'en' ? 'Brand' : 'البراند'}</label>
              <select className={fieldClass} value={brandCode} onChange={(e) => setBrandCode(e.target.value)}>
                <option value="">{locale === 'en' ? 'All brands' : 'كل البراندات'}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {locale === 'en' ? b.nameEn : b.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{locale === 'en' ? 'Recipe wastage %' : 'هدر الوصفة %'}</label>
              <input className={fieldClass} dir="ltr" value={wastagePercent} onChange={(e) => setWastagePercent(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{locale === 'en' ? 'Target food cost %' : 'هدف تكلفة الغذاء %'}</label>
              <input className={fieldClass} dir="ltr" value={targetFoodCostPercent} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-mist-300">{locale === 'en' ? 'Ingredients' : 'المكونات الخام'}</p>
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-5">
                <select
                  className={`${fieldClass} md:col-span-2`}
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
                  className={fieldClass}
                  dir="ltr"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...lines]
                    next[index] = { ...line, quantity: e.target.value }
                    setLines(next)
                  }}
                />
                <select
                  className={fieldClass}
                  value={line.unit}
                  onChange={(e) => {
                    const next = [...lines]
                    next[index] = { ...line, unit: e.target.value }
                    setLines(next)
                  }}
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="pc">pc</option>
                </select>
                <input
                  className={fieldClass}
                  dir="ltr"
                  placeholder="Waste %"
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
              className={btnGhost}
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { ingredientProductId: products[0]?.id || '', quantity: '10', unit: 'g', wastagePercent: '0' },
                ])
              }
            >
              + {locale === 'en' ? 'Ingredient' : 'مكوّن'}
            </button>
          </div>

          <div className="flex gap-2">
            <button type="button" className={btnPrimary} disabled={pending || (!canCreate && !editingId)} onClick={submit}>
              {pending ? '…' : t('action.save')}
            </button>
            {editingId ? (
              <button type="button" className={btnGhost} onClick={resetForm}>
                {t('action.cancel')}
              </button>
            ) : null}
          </div>
        </section>
      )}

      <section className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-mist-400">
                <th className="px-4 py-3 text-start">{locale === 'en' ? 'Recipe' : 'الوصفة'}</th>
                <th className="px-4 py-3 text-start">{locale === 'en' ? 'Sell' : 'البيع'}</th>
                <th className="px-4 py-3 text-start">{locale === 'en' ? 'Food cost' : 'تكلفة الغذاء'}</th>
                <th className="px-4 py-3 text-start">Food Cost %</th>
                <th className="px-4 py-3 text-start">{locale === 'en' ? 'Margin' : 'الهامش'}</th>
                <th className="px-4 py-3 text-start">{locale === 'en' ? 'Actions' : 'إجراءات'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-mist-400" colSpan={6}>
                    {locale === 'en' ? 'No recipes yet.' : 'لا وصفات بعد.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-mist-100">{locale === 'en' && row.nameEn ? row.nameEn : row.name}</p>
                      <p className="text-xs text-mist-400">
                        {row.menuName} · {row.menuCode}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold">{money(row.sellingPrice)}</td>
                    <td className="px-4 py-3">{money(row.ingredientCost)}</td>
                    <td className={`px-4 py-3 font-bold ${row.overTarget ? 'text-red-400' : 'text-[#8cc63f]'}`}>
                      {row.foodCostPercent.toFixed(1)}%
                      {row.overTarget ? ` > ${row.targetFoodCostPercent}%` : ''}
                    </td>
                    <td className="px-4 py-3">{row.marginPercent.toFixed(1)}%</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canEdit ? (
                          <button
                            type="button"
                            className={btnGhost}
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
                            className={btnGhost}
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
