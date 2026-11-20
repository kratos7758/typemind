import "server-only";
import { connection } from "next/server";

/** Random seed for one request (randomized exercises such as speed tests). */
export async function requestSeed(): Promise<number> {
  await connection(); // explicitly request-time: never prerendered or cached
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
