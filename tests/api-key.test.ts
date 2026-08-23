import { describe, expect, it } from "vitest";

import { generateApiKey, hashApiKey } from "@/lib/auth/api-key";

describe("api keys", () => {
  it("generates prefixed, high-entropy tokens", () => {
    const key = generateApiKey();
    expect(key.token.startsWith("skp_")).toBe(true);
    // 24 random bytes -> 32 base64url chars + "skp_"
    expect(key.token.length).toBe(4 + 32);
    expect(key.prefix).toBe(key.token.slice(0, 12));
    expect(key.keyHash).not.toBe(key.token);
  });

  it("hashes deterministically as sha256 hex", () => {
    const token = generateApiKey().token;
    const hash = hashApiKey(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(token)).toBe(hash);
    expect(hashApiKey(token + "x")).not.toBe(hash);
  });

  it("produces unique tokens and matching hashes", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.token).not.toBe(b.token);
    expect(a.keyHash).not.toBe(b.keyHash);
    // verification roundtrip: stored hash matches the plaintext presented later
    expect(hashApiKey(a.token)).toBe(a.keyHash);
  });
});
