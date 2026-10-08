import { useEffect, useState } from 'react'
import { useReducedMotionPreference } from './motion-preference'

export const assistantExamples = [
  'Recebi meu salário de R$ 3.500 hoje',
  'Gastei R$ 85 no mercado no Pix',
  'Paguei R$ 120 na conta de luz hoje',
  'Recebi R$ 250 de um trabalho extra',
]

export function useAssistantExample(active: boolean) {
  const reducedMotion = useReducedMotionPreference()
  const [example, setExample] = useState('')
  useEffect(() => {
    if (!active || reducedMotion !== false) return
    let index = 0
    let length = 0
    let deleting = false
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const text = assistantExamples[index]
      length += deleting ? -1 : 1
      setExample(text.slice(0, length))
      let delay = deleting ? 32 : 65
      if (!deleting && length === text.length) { deleting = true; delay = 2100 }
      else if (deleting && length === 0) { deleting = false; index = (index + 1) % assistantExamples.length; delay = 450 }
      timer = setTimeout(tick, delay)
    }
    timer = setTimeout(tick, 450)
    return () => clearTimeout(timer)
  }, [active, reducedMotion])
  return active && reducedMotion === false ? (example || ' ') + '▏' : assistantExamples[0]
}
