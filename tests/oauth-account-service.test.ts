import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { resolveOAuthUser } from "@/lib/services/oauth-account-service";

const identity = {
  provider: "google" as const,
  providerAccountId: "google-subject-1",
  email: "USER@Example.com ",
  name: "Example User",
};

function selectResult(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

function insertResult(rows: unknown[]) {
  return {
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe("resolveOAuthUser", () => {
  it("reuses the user linked to a known provider identity", async () => {
    const tx = {
      select: vi.fn().mockReturnValue(selectResult([{ userId: "user-linked" }])),
      insert: vi.fn(),
    };
    dbMock.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)
    );

    await expect(resolveOAuthUser(identity)).resolves.toEqual({ id: "user-linked" });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("links a new provider identity to an existing matching email", async () => {
    const accountInsert = insertResult([{ userId: "user-existing" }]);
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectResult([]))
        .mockReturnValueOnce(selectResult([{ id: "user-existing" }])),
      insert: vi.fn().mockReturnValue(accountInsert),
    };
    dbMock.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)
    );

    await expect(resolveOAuthUser(identity)).resolves.toEqual({ id: "user-existing" });
    expect(accountInsert.values).toHaveBeenCalledWith({
      provider: "google",
      providerAccountId: "google-subject-1",
      userId: "user-existing",
    });
  });

  it("creates an OAuth-only user when the email is new", async () => {
    const userInsert = insertResult([{ id: "user-new" }]);
    const accountInsert = insertResult([{ userId: "user-new" }]);
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(selectResult([]))
        .mockReturnValueOnce(selectResult([])),
      insert: vi.fn().mockReturnValueOnce(userInsert).mockReturnValueOnce(accountInsert),
    };
    dbMock.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) =>
      callback(tx)
    );

    await expect(resolveOAuthUser(identity)).resolves.toEqual({ id: "user-new" });
    expect(userInsert.values).toHaveBeenCalledWith({
      email: "user@example.com",
      name: "Example User",
      passwordHash: null,
    });
  });
});
