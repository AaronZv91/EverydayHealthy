const EMOJI_PATTERN =
  /^(?:\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\uFE0F|\u200D\p{Extended_Pictographic})*)+$/u

export function segmentGraphemes(value) {
  if (!value) return []

  if (typeof Intl.Segmenter !== 'undefined') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map(
      (part) => part.segment
    )
  }

  return [...value]
}

/** True when value is one keyboard emoji (supports ZWJ sequences e.g. 👨‍👩‍👧). */
export function isValidRewardEmoji(value) {
  const trimmed = value.trim()
  if (!trimmed) return false

  const graphemes = segmentGraphemes(trimmed)
  if (graphemes.length !== 1) return false

  return EMOJI_PATTERN.test(graphemes[0])
}

export function sanitizeRewardEmojiInput(value) {
  if (!value) return ''

  const graphemes = segmentGraphemes(value.trim())
  const emojiGraphemes = graphemes.filter((part) => EMOJI_PATTERN.test(part))

  return emojiGraphemes.slice(0, 1).join('')
}
