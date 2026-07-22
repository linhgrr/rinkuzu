/** True only between AG-UI TEXT_MESSAGE_START and the first non-empty text delta. */
export function isAwaitingFirstAssistantText(
  role: string,
  text: string,
  statusType: string,
): boolean {
  return role === 'assistant' && text.length === 0 && statusType === 'running';
}
