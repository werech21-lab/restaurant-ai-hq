import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type FeryalRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Legacy `/erp/feryal` route cleanly redirects to the unified Multimodal Vision & Video Studio
 * at `/erp/feryal-ai`, preserving `?prompt=...` and all other query parameters.
 */
export default async function FeryalCentralGovernancePage({
  searchParams,
}: FeryalRedirectPageProps) {
  const resolved = searchParams ? await searchParams : {}
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') {
      params.append(key, value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          params.append(key, item)
        }
      }
    }
  }

  const query = params.toString()
  const preservedQueryString = query ? `?${query}` : ''
  redirect('/erp/feryal-ai' + preservedQueryString)
}
