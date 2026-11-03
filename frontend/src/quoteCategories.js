export const categoryDimensions = [
  { key: 'tones', field: 'toneIds', label: 'Tone', description: 'What it does to the reader' },
  { key: 'themes', field: 'themeIds', label: 'Theme', description: 'What it is about' },
  { key: 'forms', field: 'formIds', label: 'Form', description: 'How it is built' },
  { key: 'sources', field: 'sourceIds', label: 'Source', description: 'Where it came from, not the precise location' },
]

export function validateCategoryCatalog(catalog) {
  for (const { key, label } of categoryDimensions) {
    const options = catalog?.[key]
    if (!Array.isArray(options) || options.some((option) =>
      !option || !Number.isSafeInteger(option.id) || option.id <= 0 ||
      typeof option.name !== 'string' || !option.name.trim() ||
      (option.description != null && typeof option.description !== 'string')) ||
      new Set(options.map((option) => option.id)).size !== options.length) {
      throw new Error(`The categories endpoint returned an invalid ${label.toLowerCase()} catalog`)
    }
  }
  return catalog
}

export function categorySelections(quote) {
  return Object.fromEntries(categoryDimensions.map(({ key, field }) => [
    field, (quote?.[key] ?? []).map((category) => category.id),
  ]))
}
