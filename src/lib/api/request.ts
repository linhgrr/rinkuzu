import type { ZodIssue, ZodType } from 'zod';

type RouteParamValue = string | string[] | undefined;
export type RouteParams = Record<string, RouteParamValue>;

type JsonBodyResult =
  | { success: true; data: unknown }
  | { success: false; error: 'Request body must be valid JSON' };

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fields: Record<string, string> };

type ValidationFailure = Extract<ValidationResult<never>, { success: false }>;

function toValidationFailure(issues: ZodIssue[]): ValidationFailure {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return {
    success: false,
    error: issues[0]?.message ?? 'Validation failed',
    fields,
  };
}

async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  try {
    return { success: true, data: await request.json() };
  } catch {
    return { success: false, error: 'Request body must be valid JSON' };
  }
}

export async function readAndValidateJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ValidationResult<T>> {
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
  return toValidationFailure(parsed.error.issues);
}

export function readAndValidateSearchParams<T>(
  request: Request,
  schema: ZodType<T>,
): ValidationResult<T> {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  return parsed.success ? parsed : toValidationFailure(parsed.error.issues);
}

export function readAndValidateRouteParams<T>(
  params: RouteParams,
  schema: ZodType<T>,
): ValidationResult<T> {
  const parsed = schema.safeParse(params);
  return parsed.success ? parsed : toValidationFailure(parsed.error.issues);
}
