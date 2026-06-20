import { createMiddleware } from "hono/factory";
import { oAuthClient } from "../services/googleAuth.js";
import type { TokenPayload } from "google-auth-library";

const auth = createMiddleware<{ Variables: { payload: TokenPayload } }>(
  async (c, next) => {
    const authHeader = c.req.header("xxx-auth-token");
    console.log(authHeader);
    if (!authHeader) return c.json({ message: "auth header not present" }, 401);

    try {
      const ticket = await oAuthClient.verifyIdToken({
        idToken: authHeader,
        audience: process.env.GOOGLE_AUTH_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) return c.json({ message: "invalid payload" }, 422);

      c.set("payload", payload);
      await next();
    } catch (error) {
      return c.json({ message: "invalid login" }, 401);
    }
  },
);

export { auth as authMiddleware };
