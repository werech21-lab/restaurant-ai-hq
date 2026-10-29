export const memoryDomains = ['pricing', 'task_routing', 'contracts', 'compliance'] as const
export type MemoryDomain = (typeof memoryDomains)[number]

export function nextMemory(
  current: { weight: number; confidence: number },
  decision: 'approved' | 'blocked',
): { weight: number; confidence: number } {
  const weightStep = decision === 'approved' ? 5 : 2
  const confidenceStep = decision === 'approved' ? 3 : 1
  return {
    weight: Math.min(100, Math.max(-100, current.weight + weightStep)),
    confidence: Math.min(100, Math.max(0, current.confidence + confidenceStep)),
  }
}
