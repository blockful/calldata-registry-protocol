"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  GitBranch,
  Plus,
} from "lucide-react";
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
import { mockDrafts, type Draft } from "@/lib/mock-proposals";

type DraftForm = {
  executor: string;
  description: string;
  extraData: string;
  target: string;
  value: string;
  calldata: string;
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
  const parentAction = parentDraft?.actions[0];

  return {
    executor: parentDraft?.executor ?? "",
    description: "",
    extraData: parentDraft?.extraData ?? "0x",
    target: parentAction?.target ?? "",
    value: parentAction?.value ?? "0",
    calldata: parentAction?.calldata ?? "0x",
  };
}

export function NewDraftScreen() {
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const previousVersion = searchParams.get("previousVersion");
  const parentDraft = useMemo(
    () => mockDrafts.find((draft) => draft.id === previousVersion),
    [previousVersion]
  );
  const [form, setForm] = useState(() => getInitialForm(parentDraft));
  const [created, setCreated] = useState(false);

  const draftId = getNextDraftId(mockDrafts);
  const canCreate =
    form.executor.trim().length > 0 &&
    form.target.trim().length > 0 &&
    form.calldata.trim().length > 0;

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
            {previousVersion ? `Fork draft #${previousVersion}` : "Create draft"}
          </h1>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeft className="size-4" />
          Back to drafts
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
              <CardTitle className="flex items-center gap-2">
                <Code2 className="size-4" />
                Calldata action
              </CardTitle>
              <CardDescription>
                This mock screen starts with one calldata action.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-[1fr_140px]">
                <div className="grid gap-2">
                  <Label htmlFor="target">Target</Label>
                  <Input
                    id="target"
                    value={form.target}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        target: event.target.value,
                      }))
                    }
                    className="font-mono"
                    placeholder="0x..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">Value</Label>
                  <Input
                    id="value"
                    value={form.value}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="calldata">Calldata</Label>
                <Textarea
                  id="calldata"
                  value={form.calldata}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      calldata: event.target.value,
                    }))
                  }
                  className="min-h-[180px] font-mono text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="grid min-w-0 gap-6 content-start">
          <Card>
            <CardHeader>
              <CardTitle>Draft preview</CardTitle>
              <CardDescription className="font-mono">
                Draft #{draftId}
              </CardDescription>
              <CardAction>
                {created ? (
                  <Badge variant="outline" className="text-emerald-200">
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
                    <TableHead>Target</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">
                      {form.target ? shortAddress(form.target) : "--"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {form.value || "0"}
                    </TableCell>
                  </TableRow>
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
                <CardTitle>Parent draft</CardTitle>
                <CardDescription className="font-mono">
                  Draft #{parentDraft.id}
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
