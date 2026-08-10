/** Build a multipart body for S3-compatible presigned POST uploads. */
export function buildPresignedPostBody(fields: Record<string, string>, file: File): FormData {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  formData.append('file', file);
  return formData;
}
