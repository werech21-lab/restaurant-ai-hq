'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRunner } from '@/components/erp/actions'
import { apiRequest } from '@/components/erp/api'
import {
  FormIssues,
  IamFact,
  IamField,
  RequestFailure,
  fieldIssue,
  iamInputClass,
  iamNoticeClass,
  iamPrimaryBtn,
  iamSecondaryBtn,
} from '@/components/erp/iam/shared'
import { SectionCard } from '@/components/ui/section-card'
import { UNAVAILABLE_DASH, type FormatLocale } from '@/lib/format'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { acceptInvitationSchema } from '@/lib/iam/schemas'
import type { AcceptedInvitation } from '@/lib/iam/types'

const issuesFor: Record<string, MessageKey> = { token: 'iam.err.form.token' }

/**
 * Accepts an invitation with the token alone. The signed-in session is enough: this call does not use a company permission.
 */
export default function AcceptInvitation({ initialToken }: { initialToken: string }) {
  const { t, locale } = useI18n()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const [token, setToken] = useState(initialToken)
  const [accepted, setAccepted] = useState<AcceptedInvitation | null>(null)
  const [issues, setIssues] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()

  function submit() {
    setIssues([])
    const parsed = acceptInvitationSchema.safeParse({ token: token.trim() })
    if (!parsed.success) {
      setIssues(
        Array.from(new Set(parsed.error.issues.map((issue) => fieldIssue(issue.path, issuesFor)))),
      )
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: AcceptedInvitation }>(
        '/api/v1/iam/invitations/accept',
        { method: 'POST', body: parsed.data },
      )
      setAccepted(result.data)
    })
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <div>
        <Link
          href="/erp"
          className="ds-focus-ring inline-flex items-center text-sm font-semibold text-[var(--ds-accent)] hover:underline"
        >
          {t('erp.back')}
        </Link>
      </div>

      <SectionCard
        title={t('iam.accept.title')}
        subtitle={t('iam.accept.subtitle')}
        locale={fmtLocale}
        className="max-w-xl"
      >
        {accepted ? (
          <div className="space-y-4">
            <p role="status" className={iamNoticeClass}>
              {t('iam.accept.done')}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <IamFact label={t('iam.accept.role')}>
                {accepted.roleName || UNAVAILABLE_DASH}
              </IamFact>
              <IamFact label={t('iam.accept.companyId')}>
                <span dir="ltr" className="ds-num break-all font-mono text-xs tabular-nums">
                  {accepted.tenantId || UNAVAILABLE_DASH}
                </span>
              </IamFact>
            </div>
            <div className="flex justify-end">
              <Link href="/erp" className={iamPrimaryBtn}>
                {t('erp.back')}
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
            className="space-y-4"
          >
            <IamField label={t('iam.accept.token')}>
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                maxLength={80}
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                className={iamInputClass}
              />
              <span className="mt-1 block text-xs text-[var(--ds-text-muted)]">
                {t('iam.accept.tokenHint')}
              </span>
            </IamField>
            <FormIssues issues={issues} />
            <RequestFailure failure={failure} />
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/erp/iam" className={iamSecondaryBtn}>
                {t('erp.cancel')}
              </Link>
              <button type="submit" disabled={pending} className={iamPrimaryBtn}>
                {pending ? t('erp.loading') : t('iam.accept.submit')}
              </button>
            </div>
          </form>
        )}
      </SectionCard>
    </div>
  )
}
