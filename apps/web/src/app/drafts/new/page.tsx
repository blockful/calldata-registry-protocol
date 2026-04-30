import { Suspense } from "react";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { NewDraftScreen } from "@/components/NewDraftScreen";

export default async function NewDraftPage() {
  await connection();

  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Loading draft form...
            </CardContent>
          </Card>
        </div>
      }
    >
      <NewDraftScreen />
    </Suspense>
  );
}
