'use client'

import { cloneElement, isValidElement, type ReactNode } from 'react'
import { usePreferences } from '@/context/PreferencesContext'

type TranslatableProps = {
  children?: ReactNode
  placeholder?: string
  title?: string
  'aria-label'?: string
}

function localizeNode(node: ReactNode, translate: (phrase: string) => string): ReactNode {
  if (typeof node === 'string') {
    const phrase = node.trim()
    if (!phrase) return node
    const leading = node.match(/^\s*/)?.[0] || ''
    const trailing = node.match(/\s*$/)?.[0] || ''
    return `${leading}${translate(phrase)}${trailing}`
  }

  if (Array.isArray(node)) return node.map((child) => localizeNode(child, translate))
  if (!isValidElement<TranslatableProps>(node)) return node

  const props: Partial<TranslatableProps> = {}
  for (const attribute of ['placeholder', 'title', 'aria-label'] as const) {
    const value = node.props[attribute]
    if (value) props[attribute] = translate(value)
  }

  return cloneElement(node, props, localizeNode(node.props.children, translate))
}

export function LocalizedDashboardContent({ children }: { children: ReactNode }) {
  const { t } = usePreferences()
  // Only exact dictionary matches are translated, leaving names and free text intact.
  return localizeNode(children, t)
}
