/** Shared by the Node 24 collector and the UI; existing stored titles need no backfill. */
export function normalizeEventTitle(value: unknown): string {
  if (typeof value !== 'string') return ''
  const text = value.replace(/[\s\u200B\uFEFF]+/gu, ' ').trim()
  // Preserve quotation marks around phrases, while fixing apostrophes inside words.
  const quotes = new Set<number>()
  for (const match of text.matchAll(/(^|[\s(])(['‘])(?=\S).*?['’](?=$|[\s).,!?:;])/gu)) {
    quotes.add(match.index! + match[1].length)
    quotes.add(match.index! + match[0].length - 1)
  }
  return text.replace(/(\p{L})\s*([`´‘ʼ'’])\s*(?=\p{L})/gu, (part: string, letter: string, apostrophe: string, offset: number) =>
    quotes.has(offset + part.indexOf(apostrophe, letter.length)) ? part : `${letter}’`)
}
