"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { createApiKeyAction, revokeApiKeyAction } from "@/actions/api-key.actions";
import { DeleteButton } from "@/components/features/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate } from "@/lib/utils/date";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
};

export function ApiKeysCard({ keys }: { keys: ApiKeyRow[] }) {
  const [name, setName] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function create() {
    startTransition(async () => {
      const res = await createApiKeyAction(name);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setToken(res.token ?? null);
      setCopied(false);
      setName("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API keys (MCP access)</CardTitle>
        <CardDescription>
          Let AI agents manage this portfolio over MCP at <code>/mcp</code>{" "}
          (Bearer auth). Keys grant full read/write access to your data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          <Input
            placeholder="Key name, e.g. claude-desktop"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button onClick={create} disabled={pending || !name.trim()} className="w-full sm:w-auto">
            Create key
          </Button>
        </div>

        {token && (
          <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
            <p className="mb-2 font-medium">Copy this key now — it is shown only once.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                {token}
              </code>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy key"
                onClick={() => {
                  navigator.clipboard.writeText(token);
                  setCopied(true);
                  toast.success("Copied");
                }}
              >
                {copied ? (
                  <CheckIcon />
                ) : (
                  <CopyIcon />
                )}
              </Button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <Empty className="p-8">
            <EmptyDescription>No API keys yet.</EmptyDescription>
          </Empty>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                      <TableCell>{fmtDate(k.createdAt)}</TableCell>
                      <TableCell>{k.lastUsedAt ? fmtDate(k.lastUsedAt) : "—"}</TableCell>
                      <TableCell>
                        {k.revoked ? (
                          <Badge variant="secondary">Revoked</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!k.revoked && (
                          <div className="flex justify-end">
                            <DeleteButton
                              action={revokeApiKeyAction.bind(null, k.id)}
                              confirmText="Revoke this key? Agents using it will lose access."
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden">
              <div className="divide-y">
                {keys.map((k) => (
                  <div key={k.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{k.name}</span>
                      <div className="flex items-center gap-1">
                        {k.revoked ? (
                          <Badge variant="secondary">Revoked</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                        {!k.revoked && (
                          <DeleteButton
                            action={revokeApiKeyAction.bind(null, k.id)}
                            confirmText="Revoke this key? Agents using it will lose access."
                          />
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{k.prefix}…</span>
                      <span> · Created {fmtDate(k.createdAt)}</span>
                      <span> · Last used {k.lastUsedAt ? fmtDate(k.lastUsedAt) : "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
