// Substitute {{name}}/{{phone}} placeholders in a canned-reply body from the
// active conversation's contact. Unknown placeholders are left intact so the
// agent notices and can fill them in. Pure — unit-testable.

export interface CannedVarContext {
  name?: string | null;
  phone?: string | null;
}

export function substituteVars(body: string, ctx: CannedVarContext): string {
  return body.replace(/\{\{(\w+)\}\}/g, (full, key: string) => {
    if (key === "name" && ctx.name) return ctx.name;
    if (key === "phone" && ctx.phone) return ctx.phone;
    return full; // unknown var, or value missing → leave the placeholder untouched
  });
}
