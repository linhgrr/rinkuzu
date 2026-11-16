/**
 * Marker our own agents put in the User-Agent of every request to production or
 * a preview (`rinkuzu-agent/<position>`, RIN-1674). Analytics skips such traffic
 * on the client and the server (RIN-1760); the rest of the product treats it as
 * any other visitor.
 */
const AGENT_USER_AGENT_MARKER = 'rinkuzu-agent/';

export function isAgentUserAgent(userAgent: string | null | undefined): boolean {
  return typeof userAgent === 'string' && userAgent.includes(AGENT_USER_AGENT_MARKER);
}
