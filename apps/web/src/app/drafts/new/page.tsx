import { NewDraftScreen } from "@/components/NewDraftScreen";

export default async function NewDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ previousVersion?: string }>;
}) {
  const { previousVersion } = await searchParams;

  return <NewDraftScreen previousVersion={previousVersion ?? null} />;
}
