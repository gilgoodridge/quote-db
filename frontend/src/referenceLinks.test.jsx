import {describe, expect, it} from 'vitest'
import {referenceHref} from './referenceLinks'

describe('reference text fragments', () => {
  const url = 'https://example.com/page?part=1'

  it('encodes the complete text at the eight-word boundary', () => {
    expect(referenceHref(url, "  One, two! three-four five six seven eight.  "))
      .toBe(`${url}#:~:text=One%2C%20two%21%20three%2Dfour%20five%20six%20seven%20eight.`)
    expect(referenceHref(url, 'One two three four five six seven eight'))
      .toBe(`${url}#:~:text=One%20two%20three%20four%20five%20six%20seven%20eight`)
  })

  it('encodes the first and last four words separately above eight words', () => {
    expect(referenceHref(url, '“One,” two three four; five six seven eight nine!'))
      .toBe(`${url}#:~:text=%E2%80%9COne%2C%E2%80%9D%20two%20three%20four%3B,six%20seven%20eight%20nine%21`)
  })

  it('preserves whitespace within selected text and encodes fragment syntax characters', () => {
    expect(referenceHref(url, "a\tb\nc 'd' (e)* f-g h i j"))
      .toBe(`${url}#:~:text=a%09b%0Ac%20%27d%27,f%2Dg%20h%20i%20j`)
  })

  it('leaves existing hashes and empty quote text unchanged', () => {
    for (const reference of [`${url}#`, `${url}#section`, `${url}#:~:text=existing`]) {
      expect(referenceHref(reference, 'A quote')).toBe(reference)
    }
    expect(referenceHref(url, ' \n ')).toBe(url)
    expect(referenceHref(url, '')).toBe(url)
  })
})
