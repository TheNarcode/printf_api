import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: "https://aware-leopard-131611.upstash.io",
  token: "gQAAAAAAAgIbAAIgcDFlMTUzZTAyM2M5NDk0MjQ1ODA4NGQ5NjgwOWI2Mzk4YQ",
});

export { redis };
