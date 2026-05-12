import { decodeDraftActions, type DecodeActionInput } from "@/lib/calldataDecoder";

export const runtime = "nodejs";

function isAction(value: unknown): value is DecodeActionInput {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  return (
    typeof action.target === "string" &&
    typeof action.value === "string" &&
    typeof action.calldata === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const actions = Array.isArray(payload.actions) ? payload.actions : null;
  const chainId =
    typeof payload.chainId === "number" && Number.isInteger(payload.chainId)
      ? payload.chainId
      : undefined;

  if (!actions || !actions.every(isAction)) {
    return Response.json(
      { error: "Expected actions with target, value, and calldata." },
      { status: 400 }
    );
  }

  const decoded = await decodeDraftActions({
    actions,
    chainId,
    extraData:
      typeof payload.extraData === "string" ? payload.extraData : undefined,
  });

  return Response.json({ actions: decoded });
}
