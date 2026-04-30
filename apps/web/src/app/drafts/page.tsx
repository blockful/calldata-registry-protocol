import Link from "next/link";
import { ArrowUpRight, GitBranch, MessageSquare } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockDrafts } from "@/lib/mock-proposals";

function shortAddress(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export default function DraftsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              <GitBranch className="size-3" />
              Drafts
            </Badge>
            <Badge variant="outline">{mockDrafts.length} total</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Draft Registry
          </h1>
        </div>
        <Button nativeButton={false} render={<Link href="/" />}>
          <ArrowUpRight className="size-4" />
          Open app
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All drafts</CardTitle>
          <CardDescription>Mocked draft records.</CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/" />}
            >
              Review
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Draft</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Executor</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Reviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDrafts.map((draft) => (
                  <TableRow key={draft.id}>
                    <TableCell className="min-w-[260px]">
                      <div className="grid gap-1">
                        <span className="font-mono font-medium">
                          Draft #{draft.id}
                        </span>
                        <span className="max-w-[34rem] truncate text-sm text-muted-foreground">
                          {draft.description || "No description"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(draft.proposer)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(draft.executor)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {draft.timestamp}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <MessageSquare className="size-3" />
                        {draft.reviews.length}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
