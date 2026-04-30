import { ProposalListPage } from "@/components/ProposalListPage";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; direction?: string }>;
}) {
  const { sort, direction } = await searchParams;

  return <ProposalListPage sortKey={sort} sortDirection={direction} />;
}
