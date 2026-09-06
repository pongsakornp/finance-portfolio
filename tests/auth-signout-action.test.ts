import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthError: class AuthError extends Error {},
}));

const signOutMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { signOutAction } from "@/actions/auth.actions";

describe("signOutAction", () => {
  it("calls signOut with redirectTo /login", async () => {
    signOutMock.mockResolvedValueOnce(undefined);

    await signOutAction();

    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
