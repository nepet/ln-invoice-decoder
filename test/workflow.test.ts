import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('deploy workflow', () => {
  const yml = () => readFileSync('.github/workflows/deploy.yml', 'utf8')

  it('runs tests before deploying', () => {
    const source = yml()
    expect(source.indexOf('npm test')).toBeLessThan(source.indexOf('deploy-pages'))
  })

  it('uploads dist and grants pages permissions', () => {
    expect(yml()).toMatch(/path:\s*dist/)
    expect(yml()).toMatch(/pages:\s*write/)
  })
})
