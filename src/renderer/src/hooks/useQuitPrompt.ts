import { useEffect, useState } from 'react'

interface QuitPromptState {
  open: boolean
  confirm: () => void
  cancel: () => void
}

function useQuitPrompt(): QuitPromptState {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    return window.api.window.onQuitPrompt(() => {
      setOpen(true)
    })
  }, [])

  const confirm = (): void => {
    setOpen(false)
    void window.api.window.confirmQuit()
  }

  const cancel = (): void => {
    setOpen(false)
    void window.api.window.cancelQuit()
  }

  return { open, confirm, cancel }
}

export default useQuitPrompt
