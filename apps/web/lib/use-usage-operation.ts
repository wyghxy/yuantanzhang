'use client'

import { useLayoutEffect, useMemo } from 'react'
import { createUsageOperationScope } from './usage-operation-scope'

export function useUsageOperation(context: string | number) {
  // A different material/account/form owns a different cancellation scope.
  const scope = useMemo(() => { void context; return createUsageOperationScope() }, [context])
  useLayoutEffect(() => () => scope.cancel(), [scope])
  return scope
}
