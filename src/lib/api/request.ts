export type JsonBodyResult =
  | { success: true; data: unknown }
  | { success: false; error: 'Request body must be valid JSON' };

export async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  try {
    return { success: true, data: await request.json() };
  } catch {
    return { success: false, error: 'Request body must be valid JSON' };
  }
}

export async function readAndValidateJson<T>(
  request: Request,
  schema: {
    safeParse(
      data: unknown,
    ):
      | { success: true; data: T }
      | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } };
  },
): Promise<
  { success: true; data: T } | { success: false; error: string; fields: Record<string, string> }
> {
  const body = await readJsonBody(request);
  if (!body.success) {
    return {
      success: false,
      error: body.error,
      fields: {},
    };
  }

  const parsed = schema.safeParse(body.data);
  if (parsed.success) return parsed;

  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return {
    success: false,
    error: parsed.error.issues[0]?.message ?? 'Validation failed',
    fields,
  };
}
