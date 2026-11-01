import { describe, expect, it } from 'vitest'
import { parseHash } from './router.jsx'

describe('hash router', () => {
  it('reads the path and query after the #', () => {
    expect(parseHash('').path).toBe('/')
    expect(parseHash('#/history').path).toBe('/history')
    const r = parseHash('#/?do=start')
    expect(r.path).toBe('/')
    expect(r.query.get('do')).toBe('start')
  })
})
