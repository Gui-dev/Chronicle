'use client'

import { useRef } from 'react'

/**
 * Radix Dialog only returns focus to a declared DialogTrigger. Dialogs opened
 * from state (open={...}) have none, so focus would land on <body> after
 * close. Snapshot document.activeElement before Radix moves focus, and hand
 * focus back once the content has left the DOM — onCloseAutoFocus runs in a
 * setTimeout after unmount, which is why this works.
 */
export function useDialogFocusRestore() {
  const triggerRef = useRef<HTMLElement | null>(null)

  return {
    onOpenAutoFocus: (_event: Event) => {
      triggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault()
      const trigger = triggerRef.current
      triggerRef.current = null
      if (trigger?.isConnected) trigger.focus()
    },
  }
}
