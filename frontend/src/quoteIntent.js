const ADD_QUOTE_INTENT = 'quote-db:add-quote-after-login'

export function hasAddQuoteIntent(storage) {
  return storage.getItem(ADD_QUOTE_INTENT) === 'true'
}

export function saveAddQuoteIntent(storage) {
  storage.setItem(ADD_QUOTE_INTENT, 'true')
}

export function clearAddQuoteIntent(storage) {
  storage.removeItem(ADD_QUOTE_INTENT)
}
