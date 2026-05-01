import { redirect } from "next/navigation";

export default async function ExecutorPage({
  params,
}: {
  params: Promise<{ executor: string }>;
}) {
  const { executor } = await params;

  redirect(`/?executor=${encodeURIComponent(decodeURIComponent(executor))}`);
}
