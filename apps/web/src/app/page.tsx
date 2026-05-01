import { ProposalListPage } from "@/components/ProposalListPage";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    author?: string;
    executor?: string;
    review?: string;
    sort?: string;
    direction?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const {
    q,
    author,
    executor,
    review,
    sort,
    direction,
    page,
    pageSize,
  } = await searchParams;

  return (
    <ProposalListPage
      q={q}
      author={author}
      executor={executor}
      review={review}
      sortKey={sort}
      sortDirection={direction}
      page={page}
      pageSize={pageSize}
    />
  );
}
