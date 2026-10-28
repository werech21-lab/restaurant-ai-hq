'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Fact, Field, useRunner } from '@/components/erp/actions'
import { apiRequest } from '@/components/erp/api'
import { inputClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { Num } from '@/components/ui'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { acceptInvitationSchema } from '@/lib/iam/schemas'
import type { AcceptedInvitation } from '@/lib/iam/types'
import { fieldIssue, FormIssues, RequestFailure } from '@/components/erp/iam/shared'

const issuesFor: Record<string, MessageKey> = { token: 'iam.err.form.token' }

/**
 * Accepts an invitation with the token alone. The signed-in session is enough: this call does not use a company permission.
 */
export default function AcceptInvitation({ initialToken }: { initialToken: string }) {
  const { t } = useI18n()
  const [token, setToken] = useState(initialToken)
  const [accepted, setAccepted] = useState<AcceptedInvitation | null>(null)
  const [issues, setIssues] = useState<MessageKey[]>([])
  const { pending, failure, run } = useRunner()

  function submit() {
    setIssues([])
    const parsed = acceptInvitationSchema.safeParse({ token: token.trim() })
    if (!parsed.success) {
      setIssues(Array.from(new Set(parsed.error.issues.map((issue) => fieldIssue(issue.path, issuesFor)))))
      return
    }
    void run(async () => {
      const result = await apiRequest<{ data: AcceptedInvitation }>('/api/v1/iam/invitations/accept', { method: 'POST', body: parsed.data })
      setAccepted(result.data)
    })
  }

  return (
    <div>
      <Link href="/erp" className="mb-6 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('erp.back')}
      </Link>
      <h1 className="text-2xl font-bold text-mist-100">{t('iam.accept.title')}</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-400">{t('iam.accept.subtitle')}</p>

      <div className={`${panelClass} mt-6 max-w-xl`}>
        {accepted ? (
          <div className="space-y-4">
            <p role="status" className={noticeClass}>
              {t('iam.accept.done')}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Fact label={t('iam.accept.role')}>{accepted.roleName}</Fact>
              <Fact label={t('iam.accept.companyId')}>
                <Num>{accepted.tenantId}</Num>
              </Fact>
            </div>
            <div className="flex justify-end">
              <Link href="/erp" className={`${primaryButton} inline-block`}>
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
            <Field label={t('iam.accept.token')}>
              <input value={token} onChange={(event) => setToken(event.target.value)} maxLength={80} dir="ltr" autoComplete="off" spellCheck={false} className={inputClass} />
              <span className="mt-1 block text-xs text-gray-500">{t('iam.accept.tokenHint')}</span>
            </Field>
            <FormIssues issues={issues} />
            <RequestFailure failure={failure} />
            <div className="flex flex-wrap justify-end gap-2">
              <Link href="/erp/iam" className={`${secondaryButton} inline-block`}>
                {t('erp.cancel')}
              </Link>
              <button type="submit" disabled={pending} className={primaryButton}>
                {pending ? t('erp.loading') : t('iam.accept.submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
