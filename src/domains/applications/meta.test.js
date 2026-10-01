import { describe, expect, it } from 'vitest'
import { primaryProgress } from './meta'

describe('primaryProgress', () => {
  it('maps the 7 screens onto 3 phases with a front-loaded percent', () => {
    const p = [1, 2, 3, 4, 5, 6, 7].map(primaryProgress)
    expect(p.map((x) => x.phase)).toEqual([1, 1, 2, 2, 3, 3, 3])
    expect(p.map((x) => x.percent)).toEqual([10, 30, 45, 60, 75, 85, 95])
    expect(p.map((x) => Math.round(x.position * 1000) / 1000)).toEqual([1, 1.5, 2, 2.5, 3, 3.333, 3.667])
    expect(p[2].label).toBe('Rumah & Pinjaman')
  })
})
