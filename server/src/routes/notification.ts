import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import database from "../database/index.js";
import { fcmTokens } from "../database/schema.js";
import { authMiddleware } from "../middlewares/auth.js";

const app = new Hono();

app.post(
  "/register",
  authMiddleware,
  zValidator("json", z.object({ token: z.string() })),
  async (c) => {
    const { token } = c.req.valid("json");
    const payload = c.get("payload");
    const email = payload.email!;

    const existing = await database.query.fcmTokens.findFirst({
      where: eq(fcmTokens.token, token),
    });

    if (existing) {
      if (existing.email !== email) {
        await database
          .update(fcmTokens)
          .set({ email })
          .where(eq(fcmTokens.token, token));
      }
      return c.json({ message: "token registered" });
    }

    await database.insert(fcmTokens).values({ email, token });
    return c.status(200);
  },
);

export default app;
