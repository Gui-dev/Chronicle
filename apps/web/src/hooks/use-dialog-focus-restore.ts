'use client'

import { useRef } from 'react'

/**
 * Where the trigger sat at open time: its ancestor chain plus each ancestor's
 * document-order neighbors. Captured while the document is still intact —
 * once the trigger's subtree unmounts (a deleted card), neither it nor its
 * neighbors are reachable from the detached node.
 */
interface FocusLevel {
  self: Element
  next: Element | null
  prev: Element | null
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'

function isFocusable(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.matches(FOCUSABLE_SELECTOR)
}

/**
 * Hands focus to the nearest thing that survived where the trigger sat:
 * document-order neighbors first (the card next to the removed one), then the
 * nearest focusable ancestor (the #timeline section, then main) — never
 * <body>, where the next Tab would restart from the top of the document.
 */
function focusSurvivor(levels: FocusLevel[]): boolean {
  for (const { next, prev } of levels) {
    for (const candidate of [next, prev]) {
      if (candidate?.isConnected && isFocusable(candidate)) {
        candidate.focus()
        return true
      }
    }
  }
  for (const { self } of levels) {
    if (self.isConnected && isFocusable(self)) {
      self.focus()
      return true
    }
  }
  return false
}

/**
 * Radix Dialog only returns focus to a declared DialogTrigger. Root cause of
 * the missed restore: modal DialogContent composes onCloseAutoFocus with an
 * unconditional preventDefault() + focus-to-triggerRef handoff, and for a
 * dialog opened from state (open={...}) that triggerRef is null — so focus
 * would land on <body> after close.
 *
 * Snapshot document.activeElement in onOpenAutoFocus, the moment before Radix
 * moves focus into the container (Radix can skip the handler when focus is
 * already inside it, which would leave the snapshot empty — not reachable for
 * the dialogs using this hook today), and hand focus back in onCloseAutoFocus,
 * which runs in a setTimeout after the content has left the DOM, which is why
 * this works.
 *
 * If the snapshotted trigger is already gone at that point (its card was
 * deleted behind the dialog), focusSurvivor picks a survivor from the levels
 * captured at open. If the trigger is still there but doomed — closing a
 * confirm dialog after a delete also invalidates the query, and that refetch
 * unmounts the freshly focused card moments later — a MutationObserver on the
 * captured levels catches the removal and runs the same handoff, as long as
 * the browser actually dropped focus to <body> (focus the user moved elsewhere
 * is left alone).
 */
export function useDialogFocusRestore() {
  const triggerRef = useRef<HTMLElement | null>(null)
  const levelsRef = useRef<FocusLevel[]>([])
  const observerRef = useRef<MutationObserver | null>(null)

  return {
    onOpenAutoFocus: (_event: Event) => {
      // A previous restore may still be watching its (still connected)
      // trigger; a new open supersedes it.
      observerRef.current?.disconnect()
      observerRef.current = null

      const active = document.activeElement
      triggerRef.current = active instanceof HTMLElement ? active : null

      const levels: FocusLevel[] = []
      for (
        let node: Element | null = triggerRef.current;
        node && node !== document.body;
        node = node.parentElement
      ) {
        levels.push({
          self: node,
          next: node.nextElementSibling,
          prev: node.previousElementSibling,
        })
      }
      levelsRef.current = levels
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault()
      const trigger = triggerRef.current
      const levels = levelsRef.current
      triggerRef.current = null
      levelsRef.current = []

      if (!trigger?.isConnected) {
        focusSurvivor(levels)
        return
      }

      trigger.focus()

      // The trigger can be doomed even while connected: the close that just
      // restored focus may be followed by the refetch that unmounts this very
      // button. childList on the levels is enough — removing the trigger (or
      // any level) is a childList mutation on its parent, which is itself a
      // level. If the browser drops focus to <body> with it, hand focus to a
      // survivor; if the user got there first, leave focus alone.
      observerRef.current?.disconnect()
      const observer = new MutationObserver(() => {
        if (trigger.isConnected) return
        observer.disconnect()
        observerRef.current = null
        const active = document.activeElement
        if (active !== null && active !== document.body) return
        focusSurvivor(levels)
      })
      for (const { self } of levels) observer.observe(self, { childList: true })
      observerRef.current = observer
    },
  }
}
