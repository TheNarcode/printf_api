import { createMiddleware } from "hono/factory";

export const razorpayWebhookMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { rawBody: string };
}>(async (c, next) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("X-Razorpay-Signature");

  if (!signature) return c.body(null, 400);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(c.env.RAZORPAY_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected !== signature) return c.body(null, 401);

  c.set("rawBody", rawBody);
  await next();
});
