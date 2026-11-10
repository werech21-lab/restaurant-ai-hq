import { redirect } from 'next/navigation'

/**
 * aetherbi.com has no public landing page: the root always opens the Aether BI workspace.
 * (next.config.js also redirects "/" → "/erp" before this page is reached.)
 */
export default function RootPage(): never {
  redirect('/erp')
}
