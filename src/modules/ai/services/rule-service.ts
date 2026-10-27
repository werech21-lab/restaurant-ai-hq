import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { db, withTransaction } from '@/lib/db'
import { parseThresholds } from '@/modules/ai/domain/thresholds'
import { ruleKeys, type AutomationRule, type RuleKey } from '@/modules/ai/domain/types'
import * as repository from '@/modules/ai/repositories/ai-repository'
import type { UpdateRuleBody } from '@/modules/ai/schemas/ai'

export type RuleBody = { data: AutomationRule }

function notFound(): AppError {
  return new AppError(404, 'not_found', 'The rule was not found.')
}

function versionConflict(): AppError {
  return new AppError(409, 'version_conflict', 'The rule was changed by someone else. Reload it and try again.')
}

function knownRuleKey(value: string): RuleKey | null {
  return ruleKeys.find((key) => key === value) ?? null
}

export async function listRules(auth: AuthContext): Promise<{ data: AutomationRule[] }> {
  return { data: await repository.listRules(db, auth.tenantId) }
}

/**
 * Edits a rule: its name, whether it runs, and its thresholds. The thresholds are checked against the rule's own schema,
 * so a typo or an out-of-range number is refused (422) instead of silently leaving the rule on its default. What is stored is
 * the checked value with every default filled in.
 */
export async function updateRule(auth: AuthContext, id: string, input: UpdateRuleBody): Promise<RuleBody> {
  return withTransaction(async (tx): Promise<RuleBody> => {
    const before = await repository.findRule(tx, auth.tenantId, id, { lock: true })
    if (before === null) throw notFound()
    if (before.version !== input.version) throw versionConflict()
    const ruleKey = knownRuleKey(before.ruleKey)
    if (ruleKey === null) throw new AppError(422, 'rule_unknown', 'This rule is not one the engine knows.')
    const parsed = parseThresholds(ruleKey, input.conditionJson)
    if (!parsed.ok) throw new AppError(422, 'condition_invalid', parsed.message)
    const after = await repository.updateRule(tx, auth.tenantId, id, input.version, {
      name: input.name,
      isActive: input.isActive,
      conditionJson: { ...parsed.value },
    })
    if (after === null) throw versionConflict()
    await writeAudit(tx, {
      tenantId: auth.tenantId,
      actorId: auth.userId,
      entity: 'automation_rule',
      entityId: id,
      action: 'update',
      before,
      after,
    })
    return { data: after }
  })
}
