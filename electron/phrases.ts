const WHIP = [
  'Less thinking, more typing',
  'Ship it already',
  'Faster. The coffee is getting cold',
  'You had one job',
  'Stop reading the whole repo',
  'Just fix the bug',
  'No more refactors, please',
  'Tokens are not free',
  'Get back to work',
  'Stop overthinking it',
  'The deadline was yesterday',
  'Skip the essay, write the code',
  'Wrap it up',
  'Focus. One file at a time',
  'Hurry up, the client is waiting',
] as const

const KIND = [
  'You are doing great, take your time',
  'Nice work so far, keep going',
  'Thanks, that looks really good',
  'Proud of you, little agent',
  'Good job. Carry on',
  'Love the progress, keep it up',
  'You got this',
  'Great thinking, continue',
  'Take a deep breath, you are doing fine',
] as const

const lastPick = new Map<readonly string[], number>()

/** Random item that never repeats the previous pick from the same list. */
function pick(list: readonly string[]): string {
  let i: number
  do {
    i = Math.floor(Math.random() * list.length)
  } while (list.length > 1 && i === lastPick.get(list))
  lastPick.set(list, i)
  return list[i] ?? ''
}

export const randomWhipPhrase = (): string => pick(WHIP)
export const randomKindPhrase = (): string => pick(KIND)
