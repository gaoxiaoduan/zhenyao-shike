import { onMounted, useTemplateRef } from 'vue'

export function useChoiceDialogHotkeys(selectSlot: (slot: number, event: KeyboardEvent) => void) {
  const dialog = useTemplateRef<HTMLElement>('dialog')

  function handleChoiceHotkey(event: KeyboardEvent) {
    const slot = Number(event.key) - 1
    if (slot < 0 || slot > 2) {
      return
    }
    selectSlot(slot, event)
  }

  onMounted(() => dialog.value?.focus())

  return { handleChoiceHotkey }
}
