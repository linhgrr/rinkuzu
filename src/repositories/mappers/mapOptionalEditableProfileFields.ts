export interface OptionalEditableProfileFields {
  displayName?: string;
  bio?: string;
  avatar?: string;
}

export function mapOptionalEditableProfileFields(
  source: OptionalEditableProfileFields,
): OptionalEditableProfileFields {
  return {
    ...(source.displayName === undefined ? {} : { displayName: source.displayName }),
    ...(source.bio === undefined ? {} : { bio: source.bio }),
    ...(source.avatar === undefined ? {} : { avatar: source.avatar }),
  };
}
