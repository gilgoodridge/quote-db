function encodeFragmentText(text) {
  return encodeURIComponent(text.toWellFormed()).replace(/[!'()*-]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
}

export function referenceHref(url, quoteText) {
  if (url.includes('#') || !quoteText?.trim()) return url

  const text = quoteText.trim()
  const words = [...text.matchAll(/\S+/g)]
  const fragment = words.length > 8
    ? `${encodeFragmentText(text.slice(0, words[3].index + words[3][0].length))},${encodeFragmentText(text.slice(words[words.length - 4].index))}`
    : encodeFragmentText(text)

  return `${url}#:~:text=${fragment}`
}
