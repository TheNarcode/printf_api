import { createMiddleware } from "hono/factory";
import { oAuthClient } from "../services/googleAuth";
import type { TokenPayload } from "google-auth-library";

const auth = createMiddleware<{
  Variables: { payload: TokenPayload };
  Bindings: Env;
}>(async (c, next) => {
  const authHeader = c.req.header("xxx-auth-token");
  if (!authHeader) return c.body(null, 401);

  try {
    const ticket = await oAuthClient.verifyIdToken({
      idToken: authHeader,
      audience: c.env.GOOGLE_AUTH_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return c.body(null, 422);

    c.set("payload", payload);
    await next();
  } catch (error) {
    return c.body(null, 401);
  }
});

export { auth as authMiddleware };
