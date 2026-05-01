"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  Plus,
} from "lucide-react";
import { CalldataCallBuilder } from "@/components/CalldataCallBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  mockDrafts,
  type CalldataAction,
  type Draft,
} from "@/lib/mock-proposals";

type DraftForm = {
  executor: string;
  description: string;
  extraData: string;
  actions: CalldataAction[];
};

function shortAddress(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function getNextDraftId(drafts: Draft[]) {
  return String(
    drafts.reduce((max, draft) => {
      const numericId = Number(draft.id);
      return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
    }, 0) + 1
  );
}

function getInitialForm(parentDraft?: Draft): DraftForm {
  return {
    executor: parentDraft?.executor ?? "",
    description: "",
    extraData: parentDraft?.extraData ?? "0x",
    actions:
      parentDraft?.actions.map((action, index) => ({
        ...action,
        id: `new-${action.id}-${index}`,
      })) ?? [
        {
          id: "new-action-1",
          target: "",
          value: "0",
          calldata: "0x",
        },
      ],
  };
}

export function NewDraftScreen({
  previousVersion,
}: {
  previousVersion: string | null;
}) {
  const { address } = useAccount();
  const parentDraft = useMemo(
    () => mockDrafts.find((draft) => draft.id === previousVersion),
    [previousVersion]
  );
  const [form, setForm] = useState(() => getInitialForm(parentDraft));
  const [created, setCreated] = useState(false);

  const draftId = getNextDraftId(mockDrafts);
  const canCreate =
    form.executor.trim().length > 0 &&
    form.actions.length > 0 &&
    form.actions.every(
      (action) => action.target.trim().length > 0 && action.calldata.trim().length > 0
    );

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              <GitBranch className="size-3" />
              {previousVersion ? "Fork" : "New"}
            </Badge>
            <Badge variant="outline">
              previousVersion = {previousVersion ?? "0"}
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {previousVersion
              ? `Fork #${previousVersion}`
              : "Create draft"}
          </h1>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft className="size-4" />
          Calldata Registry Protocol
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="grid min-w-0 gap-6 content-start">
          <Card>
            <CardHeader>
              <CardTitle>Draft details</CardTitle>
              <CardDescription>
                Fields map to `publishDraft` inputs.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="executor">Executor address or ENS</Label>
                <Input
                  id="executor"
                  value={form.executor}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      executor: event.target.value,
                    }))
                  }
                  className="font-mono"
                  placeholder="0x... or name.eth"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-[120px]"
                  placeholder="Markdown description"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                <div className="grid gap-2">
                  <Label htmlFor="extra-data">Extra data</Label>
                  <Input
                    id="extra-data"
                    value={form.extraData}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        extraData: event.target.value,
                      }))
                    }
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="previous-version">Previous version</Label>
                  <Input
                    id="previous-version"
                    value={previousVersion ?? "0"}
                    className="font-mono"
                    readOnly
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calls</CardTitle>
              <CardDescription>
                Add one or more calls, build from an ABI, or paste raw encoded data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalldataCallBuilder
                actions={form.actions}
                onChange={(actions) =>
                  setForm((current) => ({
                    ...current,
                    actions,
                  }))
                }
              />
            </CardContent>
          </Card>
        </main>

        <aside className="grid min-w-0 gap-6 content-start">
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription className="font-mono">
                #{draftId}
              </CardDescription>
              <CardAction>
                {created ? (
                  <Badge variant="outline" className="text-foreground">
                    <CheckCircle2 className="size-3" />
                    Created locally
                  </Badge>
                ) : null}
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 text-sm">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Author</span>
                  <span className="break-all font-mono">
                    {address ?? "not connected"}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Executor</span>
                  <span className="break-all font-mono">
                    {form.executor || "--"}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">
                    Previous version
                  </span>
                  <span className="font-mono">{previousVersion ?? "0"}</span>
                </div>
              </div>

              <Separator />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Call</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.actions.map((action, index) => (
                    <TableRow key={action.id}>
                      <TableCell className="font-mono text-xs">
                        {String(index + 1).padStart(2, "0")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {action.target ? shortAddress(action.target) : "--"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {action.value || "0"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Button type="button" onClick={() => setCreated(true)} disabled={!canCreate}>
                <Plus className="size-4" />
                {previousVersion ? "Create fork" : "Create draft"}
              </Button>
            </CardContent>
          </Card>

          {parentDraft ? (
            <Card>
              <CardHeader>
                <CardTitle>Parent</CardTitle>
                <CardDescription className="font-mono">
                  #{parentDraft.id}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Executor</span>
                  <span className="break-all font-mono">
                    {parentDraft.executor}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <span>{parentDraft.description || "No description"}</span>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
