import { NewDraftScreen } from "@/components/NewDraftScreen";

function getPreviousVersion(params: {
  previousVersion?: string;
  basedOn?: string;
  "based-on"?: string;
}) {
  if (params.previousVersion) return params.previousVersion;
  if (params.basedOn) return params.basedOn;

  const basedOnPath = params["based-on"];
  if (!basedOnPath) return null;

  const segments = basedOnPath.split("/").filter(Boolean);
  return segments.at(-1) ?? null;
}

export default async function NewDraftPage({
  searchParams,
}: {
  searchParams: Promise<{
    previousVersion?: string;
    basedOn?: string;
    "based-on"?: string;
  }>;
}) {
  const params = await searchParams;

  return <NewDraftScreen previousVersion={getPreviousVersion(params)} />;
}
