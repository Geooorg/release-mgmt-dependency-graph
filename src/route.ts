/** Static help page for automation agents, reachable as `#/agent-hilfe` (hash: works under any sub path, no server rewrite). */
const AGENT_HELP = /^#\/?agent-hilfe\/?$/i

export function isAgentHelpHash(hash: string): boolean {
  return AGENT_HELP.test(hash)
}
