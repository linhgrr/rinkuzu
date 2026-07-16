export interface IndexedStringMatch {
  $eq: string;
  $type: 'string';
}

export function matchIndexedString(value: string): IndexedStringMatch {
  return { $eq: value, $type: 'string' };
}
