export function cleanProduct(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["title", "playerokItemId", "keyword", "message", "description"] as const) {
    if (typeof body[k] === "string") out[k] = (body[k] as string).trim();
  }
  if (body.mode === "unit" || body.mode === "message") out.mode = body.mode;
  if (typeof body.enabled === "boolean") out.enabled = body.enabled;
  return out;
}
