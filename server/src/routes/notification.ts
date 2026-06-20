import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import database from "../database/index.js";
import { fcmTokens } from "../database/schema.js";
import { authMiddleware } from "../middlewares/auth.js";

const app = new Hono();

app.post(
  "/register",
  authMiddleware,
  zValidator("json", z.object({ token: z.string().min(1) })),
  async (c) => {
    const { token } = c.req.valid("json");
    const payload = c.get("payload");
    const email = payload.email!;

    // Check if this token already exists
    const existing = await database.query.fcmTokens.findFirst({
      where: eq(fcmTokens.token, token),
    });

    if (existing) {
      // Token exists — update email if it changed (device switched accounts)
      if (existing.email !== email) {
        await database
          .update(fcmTokens)
          .set({ email })
          .where(eq(fcmTokens.token, token));
      }
      return c.json({ message: "token registered" });
    }

    // New token — insert
    await database.insert(fcmTokens).values({ email, token });

    return c.json({ message: "token registered" });
  },
);

export default app;
