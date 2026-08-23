import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/** Use in server components / actions that require a logged-in user. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return id;
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
