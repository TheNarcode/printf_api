import { createMiddleware } from "hono/factory";
import { oAuthClient } from "../services/googleAuth";
import type { TokenPayload } from "google-auth-library";

const auth = createMiddleware<{ Variables: { payload: TokenPayload } }>(
  async (c, next) => {
    const authHeader = c.req.header("xxx-auth-token");
    if (!authHeader) return c.json({ message: "auth header not present" }, 401);

    try {
      const ticket = await oAuthClient.verifyIdToken({
        idToken: authHeader,
        audience: process.env.GOOGLE_AUTH_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) return c.status(422);

      c.set("payload", payload);
      await next();
    } catch (error) {
      return c.status(401);
    }
  },
);

export { auth as authMiddleware };
