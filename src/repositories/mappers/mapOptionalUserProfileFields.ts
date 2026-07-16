export interface OptionalUserProfileFields {
  name?: string;
  displayName?: string;
  avatar?: string;
}

export function mapOptionalUserProfileFields(
  source: OptionalUserProfileFields,
): OptionalUserProfileFields {
  return {
    ...(source.name === undefined ? {} : { name: source.name }),
    ...(source.displayName === undefined ? {} : { displayName: source.displayName }),
    ...(source.avatar === undefined ? {} : { avatar: source.avatar }),
  };
}
