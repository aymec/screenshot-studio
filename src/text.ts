/**
 * Caption tokenization.
 *
 * Splitting on whitespace only works for languages that use it. Japanese and Chinese
 * write without spaces ("毎日の習慣を記録"), so a whitespace split yields a single token
 * and the user can only highlight the whole caption. `Intl.Segmenter` knows the real word
 * boundaries for those scripts, so we segment with it and remember, for each token,
 * whether a space actually separated it from the previous one — the renderer must not
 * invent spaces that the language doesn't use.
 */
export interface Token {
  text: string
  /** True only when real whitespace preceded this token in the source. */
  spaceBefore: boolean
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null

/** Tokenize one line (no newlines) into highlightable units. */
export function tokenizeLine(line: string): Token[] {
  if (!segmenter) {
    // Ancient browser: whitespace is the best we can do.
    return line
      .split(/\s+/)
      .filter(Boolean)
      .map((text, i) => ({ text, spaceBefore: i > 0 }))
  }

  const tokens: Token[] = []
  let pendingSpace = false

  for (const seg of segmenter.segment(line)) {
    if (/^\s+$/.test(seg.segment)) {
      pendingSpace = true
      continue
    }
    if (seg.isWordLike) {
      tokens.push({ text: seg.segment, spaceBefore: pendingSpace && tokens.length > 0 })
      pendingSpace = false
    } else if (tokens.length > 0) {
      // Punctuation ("。", ",", "!") glues to the word before it rather than becoming its
      // own chip — nobody wants to highlight a comma.
      tokens[tokens.length - 1].text += seg.segment
      pendingSpace = false
    } else {
      tokens.push({ text: seg.segment, spaceBefore: false })
      pendingSpace = false
    }
  }

  return tokens
}

/** Tokens per hard line (split on \n), for the renderer. */
export const tokenizeLines = (sentence: string): Token[][] =>
  sentence.split('\n').map(tokenizeLine)

/** Every token in the caption, flat — this is what `highlightIndices` indexes into. */
export const tokenize = (sentence: string): Token[] => tokenizeLines(sentence).flat()
