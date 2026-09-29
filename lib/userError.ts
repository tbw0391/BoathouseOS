// Problems the person can fix ("Enter a US mobile number"), as opposed to
// bugs. Next.js hides every thrown message on the live site, so server
// actions that the page calls wrap their body in tryAction(): a UserError
// comes back as { error } for the page to show, anything else still throws
// (and stays hidden). The page calls unwrap() on the result, which throws
// the message again in the browser, where it isn't hidden.

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

export async function tryAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    throw e;
  }
}

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

// For shared "run this action" helpers that take any action: throws the
// message if the result is a failed tryAction result, otherwise passes it on.
export function unwrapIfResult(result: unknown): unknown {
  if (result && typeof result === "object" && "ok" in result) {
    const r = result as ActionResult<unknown>;
    return unwrap(r);
  }
  return result;
}
