'use client'

import { useCallback, useState } from 'react'

/** Keep read-only collection selection aligned with query navigation without replacing an open draft. */
export function useStudioCollectionLocation(view: string, draftId: string, initialView: string, initialMaterial: string) {
  const [libraryMaterialId, setLibraryMaterialId] = useState(initialView === 'works' ? initialMaterial : '')
  const [request, setRequest] = useState(initialView === 'works' ? initialMaterial : null)
  // Search-param navigation may preserve the component. Reconcile before committing an old detail/action.
  if (view === 'works' && !draftId && initialView === 'works' && request !== initialMaterial) {
    setRequest(initialMaterial)
    setLibraryMaterialId(initialMaterial)
  }
  const reflectLibrarySelection = useCallback((id: string) => {
    setLibraryMaterialId(id)
    const url = new URL(window.location.href)
    if ((url.searchParams.get('material') || '') === id) return
    if (id) url.searchParams.set('material', id)
    else url.searchParams.delete('material')
    window.history.replaceState(null, '', url)
  }, [])
  return { libraryMaterialId, setLibraryMaterialId, reflectLibrarySelection }
}
