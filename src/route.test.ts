import { describe, expect, it } from 'vitest'
import { isAgentHelpHash } from './route'

describe('isAgentHelpHash', () => {
  it.each(['#/agent-hilfe', '#/agent-hilfe/', '#agent-hilfe', '#/Agent-Hilfe'])('accepts %s', (hash) => {
    expect(isAgentHelpHash(hash)).toBe(true)
  })

  it.each(['', '#', '#/', '#/agent-hilfe/x', '#/hilfe', '#/agent-hilfe?x=1'])('rejects %j', (hash) => {
    expect(isAgentHelpHash(hash)).toBe(false)
  })
})
