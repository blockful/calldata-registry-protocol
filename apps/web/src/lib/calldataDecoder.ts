import {
  decodeFunctionData,
  parseAbi,
  toFunctionSelector,
  type Abi,
  type AbiFunction,
  type AbiParameter,
} from "viem";

export type DecodeStatus =
  | "decoded"
  | "ambiguous"
  | "empty"
  | "invalid"
  | "unknown"
  | "error";

export type DecodeSource =
  | "verified-abi"
  | "metadata"
  | "selector-db"
  | "native-transfer"
  | "raw";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface DecodedParam {
  name: string;
  type: string;
  value: JsonValue;
  children?: DecodedParam[];
  decodedBytes?: DecodedCall | null;
}

export interface DecodedCall {
  functionName: string;
  signature: string;
  selector: string | null;
  source: DecodeSource;
  confidence: "high" | "medium" | "low";
  params: DecodedParam[];
}

export interface DecodedAction {
  index: number;
  target: string;
  value: string;
  calldata: string;
  selector: string | null;
  status: DecodeStatus;
  source: DecodeSource;
  confidence: "high" | "medium" | "low" | "none";
  decoded?: DecodedCall;
  candidates?: string[];
  error?: string;
}

export interface DecodeActionInput {
  target: string;
  value: string;
  calldata: string;
}

interface DecodeContext {
  chainId?: number;
  maxDepth: number;
  seen: Set<string>;
}

const MAX_SELECTOR_CANDIDATES = 8;
const MAX_CALLDATA_CHARS = 60_000;

const selectorCandidatesCache = new Map<string, Promise<string[]>>();
const verifiedAbiCache = new Map<string, Promise<Abi | null>>();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeHex(value: string): `0x${string}` | null {
  const trimmed = value.trim();
  const hex = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x([0-9a-fA-F]{2})*$/.test(hex)) return null;
  return hex as `0x${string}`;
}

function selectorOf(calldata: string): string | null {
  return calldata.length >= 10 ? calldata.slice(0, 10).toLowerCase() : null;
}

function isNonZeroValue(value: string): boolean {
  try {
    return BigInt(value || "0") > BigInt(0);
  } catch {
    return value.trim() !== "" && value.trim() !== "0";
  }
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function canonicalParamType(param: AbiParameter): string {
  const arraySuffix = param.type.match(/(\[[0-9]*\])+$/)?.[0] ?? "";
  const baseType = param.type.slice(0, param.type.length - arraySuffix.length);

  if (baseType === "tuple" && "components" in param && param.components) {
    const components = param.components.map(canonicalParamType).join(",");
    return `(${components})${arraySuffix}`;
  }

  return param.type;
}

function functionSignature(fn: AbiFunction): string {
  return `${fn.name}(${fn.inputs.map(canonicalParamType).join(",")})`;
}

function findFunctionBySelector(abi: Abi, selector: string): AbiFunction | null {
  for (const item of abi) {
    if (item.type !== "function") continue;
    if (toFunctionSelector(functionSignature(item)) === selector) return item;
  }
  return null;
}

function jsonValue(value: unknown): JsonValue {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") {
    const result: { [key: string]: JsonValue } = {};
    for (const [key, child] of Object.entries(value)) {
      if (/^\d+$/.test(key)) continue;
      result[key] = jsonValue(child);
    }
    if (Object.keys(result).length > 0) return result;
  }
  return String(value);
}

function arrayChildParam(param: AbiParameter): AbiParameter | null {
  const match = param.type.match(/^(.*)(\[[0-9]*\])$/);
  if (!match) return null;
  return {
    ...param,
    name: "",
    type: match[1] as AbiParameter["type"],
  };
}

function tupleComponentValue(value: unknown, component: AbiParameter, index: number) {
  if (Array.isArray(value)) return value[index];
  const record = asRecord(value);
  if (!record) return undefined;
  if (component.name && component.name in record) return record[component.name];
  return record[String(index)];
}

async function decodeParam(
  param: AbiParameter,
  value: unknown,
  context: DecodeContext
): Promise<DecodedParam> {
  const decoded: DecodedParam = {
    name: param.name ?? "",
    type: param.type,
    value: jsonValue(value),
  };

  if (param.type === "bytes" && typeof value === "string") {
    decoded.decodedBytes = await decodeCalldata({
      calldata: value,
      target: "",
      context: {
        ...context,
        maxDepth: context.maxDepth - 1,
      },
    });
    return decoded;
  }

  const childParam = arrayChildParam(param);
  if (childParam && Array.isArray(value)) {
    decoded.children = await Promise.all(
      value.map((item, index) =>
        decodeParam({ ...childParam, name: `[${index}]` }, item, context)
      )
    );
    return decoded;
  }

  if (param.type.startsWith("tuple") && "components" in param && param.components) {
    decoded.children = await Promise.all(
      param.components.map((component, index) =>
        decodeParam(component, tupleComponentValue(value, component, index), context)
      )
    );
  }

  return decoded;
}

async function decodeWithAbi({
  abi,
  calldata,
  source,
  confidence,
  context,
}: {
  abi: Abi;
  calldata: `0x${string}`;
  source: DecodeSource;
  confidence: DecodedCall["confidence"];
  context: DecodeContext;
}): Promise<DecodedCall | null> {
  try {
    const decoded = decodeFunctionData({ abi, data: calldata });
    const selector = selectorOf(calldata);
    const fn = selector ? findFunctionBySelector(abi, selector) : null;
    if (!fn) return null;

    return {
      functionName: decoded.functionName,
      signature: functionSignature(fn),
      selector,
      source,
      confidence,
      params: await Promise.all(
        fn.inputs.map((input, index) =>
          decodeParam(input, decoded.args?.[index], context)
        )
      ),
    };
  } catch {
    return null;
  }
}

function abiFromSignature(signature: string): Abi | null {
  try {
    const declaration = signature.trim().startsWith("function ")
      ? signature.trim()
      : `function ${signature.trim()}`;
    return parseAbi([declaration]);
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSignatureCandidates(selector: string): Promise<string[]> {
  const cached = selectorCandidatesCache.get(selector);
  if (cached) return cached;

  const promise = (async () => {
    const candidates: string[] = [];

    try {
      const sourcifyUrl = new URL(
        "https://api.4byte.sourcify.dev/signature-database/v1/lookup"
      );
      sourcifyUrl.searchParams.set("function", selector);
      const sourcifyData = await fetchJson(sourcifyUrl.toString());
      const sourcifyResult = asRecord(asRecord(sourcifyData)?.result);
      const sourcifyFunctions = asRecord(sourcifyResult?.function);
      const sourcifyMatches = sourcifyFunctions?.[selector];
      if (Array.isArray(sourcifyMatches)) {
        candidates.push(
          ...sourcifyMatches
            .filter((item) => asRecord(item)?.filtered !== true)
            .map((item) => String(asRecord(item)?.name ?? ""))
        );
      }
    } catch {
      // Fall through to 4byte.directory below.
    }

    if (candidates.length === 0) {
      try {
        const fourByteUrl = new URL(
          "https://www.4byte.directory/api/v1/signatures/"
        );
        fourByteUrl.searchParams.set("hex_signature", selector);
        const fourByteData = await fetchJson(fourByteUrl.toString());
        const results = asRecord(fourByteData)?.results;
        if (Array.isArray(results)) {
          candidates.push(
            ...results.map((item) =>
              String(asRecord(item)?.text_signature ?? "")
            )
          );
        }
      } catch {
        return [];
      }
    }

    return dedupe(candidates).slice(0, MAX_SELECTOR_CANDIDATES);
  })();

  selectorCandidatesCache.set(selector, promise);
  return promise;
}

async function fetchVerifiedAbi(target: string, chainId?: number): Promise<Abi | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY ?? process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  if (!apiKey || !chainId || !target) return null;

  const cacheKey = `${chainId}:${target.toLowerCase()}`;
  const cached = verifiedAbiCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", String(chainId));
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "getabi");
    url.searchParams.set("address", target);
    url.searchParams.set("apikey", apiKey);

    const data = await fetchJson(url.toString());
    const result = asRecord(data)?.result;
    if (typeof result !== "string" || result === "" || result === "Contract source code not verified") {
      return null;
    }

    try {
      const abi = JSON.parse(result);
      return Array.isArray(abi) ? (abi as Abi) : null;
    } catch {
      return null;
    }
  })();

  verifiedAbiCache.set(cacheKey, promise);
  return promise;
}

async function decodeSelectorCandidates(
  calldata: `0x${string}`,
  selector: string,
  context: DecodeContext
): Promise<{ decoded: DecodedCall | null; candidates: string[]; ambiguous: boolean }> {
  const candidates = await fetchSignatureCandidates(selector);
  const successful: DecodedCall[] = [];

  for (const signature of candidates) {
    const abi = abiFromSignature(signature);
    if (!abi) continue;
    const decoded = await decodeWithAbi({
      abi,
      calldata,
      source: "selector-db",
      confidence: "medium",
      context,
    });
    if (decoded) successful.push(decoded);
  }

  return {
    decoded: successful.length === 1 ? successful[0] : null,
    candidates: candidates.length > 0 ? candidates : [],
    ambiguous: successful.length > 1,
  };
}

async function decodeCalldata({
  calldata,
  target,
  context,
}: {
  calldata: string;
  target: string;
  context: DecodeContext;
}): Promise<DecodedCall | null> {
  const normalized = normalizeHex(calldata);
  if (!normalized || normalized === "0x" || normalized.length < 10) return null;
  if (normalized.length > MAX_CALLDATA_CHARS) return null;
  if (context.maxDepth < 0) return null;

  const seenKey = normalized.toLowerCase();
  if (context.seen.has(seenKey)) return null;
  context.seen.add(seenKey);

  const verifiedAbi = await fetchVerifiedAbi(target, context.chainId);
  if (verifiedAbi) {
    const decoded = await decodeWithAbi({
      abi: verifiedAbi,
      calldata: normalized,
      source: "verified-abi",
      confidence: "high",
      context,
    });
    if (decoded) return decoded;
  }

  const selector = selectorOf(normalized);
  if (!selector || selector === "0x00000000") return null;

  const selectorResult = await decodeSelectorCandidates(normalized, selector, context);
  if (selectorResult.decoded) return selectorResult.decoded;

  return null;
}

export async function decodeDraftActions({
  actions,
  chainId,
}: {
  actions: DecodeActionInput[];
  extraData?: string;
  chainId?: number;
}): Promise<DecodedAction[]> {
  return Promise.all(
    actions.map(async (action, index) => {
      const calldata = action.calldata || "0x";
      const normalized = normalizeHex(calldata);

      if (!normalized) {
        return {
          index,
          target: action.target,
          value: action.value,
          calldata,
          selector: null,
          status: "invalid",
          source: "raw",
          confidence: "none",
          error: "Calldata is not valid hex.",
        };
      }

      const selector = selectorOf(normalized);

      if (normalized === "0x") {
        return {
          index,
          target: action.target,
          value: action.value,
          calldata: normalized,
          selector: null,
          status: "empty",
          source: isNonZeroValue(action.value) ? "native-transfer" : "raw",
          confidence: isNonZeroValue(action.value) ? "high" : "none",
          decoded: isNonZeroValue(action.value)
            ? {
                functionName: "Native transfer",
                signature: "receive()",
                selector: null,
                source: "native-transfer",
                confidence: "high",
                params: [],
              }
            : undefined,
        };
      }

      if (normalized.length < 10) {
        return {
          index,
          target: action.target,
          value: action.value,
          calldata: normalized,
          selector,
          status: "unknown",
          source: "raw",
          confidence: "none",
          error: "Calldata is too short to contain a function selector.",
        };
      }

      const context: DecodeContext = {
        chainId,
        maxDepth: 2,
        seen: new Set(),
      };

      try {
        const verifiedAbi = await fetchVerifiedAbi(action.target, chainId);
        if (verifiedAbi) {
          const decoded = await decodeWithAbi({
            abi: verifiedAbi,
            calldata: normalized,
            source: "verified-abi",
            confidence: "high",
            context,
          });
          if (decoded) {
            return {
              index,
              target: action.target,
              value: action.value,
              calldata: normalized,
              selector,
              status: "decoded",
              source: "verified-abi",
              confidence: "high",
              decoded,
            };
          }
        }

        if (!selector || selector === "0x00000000") {
          return {
            index,
            target: action.target,
            value: action.value,
            calldata: normalized,
            selector,
            status: "unknown",
            source: "raw",
            confidence: "none",
          };
        }

        const selectorResult = await decodeSelectorCandidates(normalized, selector, context);
        if (selectorResult.decoded) {
          return {
            index,
            target: action.target,
            value: action.value,
            calldata: normalized,
            selector,
            status: "decoded",
            source: "selector-db",
            confidence: "medium",
            decoded: selectorResult.decoded,
            candidates: selectorResult.candidates,
          };
        }

        if (selectorResult.ambiguous) {
          return {
            index,
            target: action.target,
            value: action.value,
            calldata: normalized,
            selector,
            status: "ambiguous",
            source: "selector-db",
            confidence: "low",
            candidates: selectorResult.candidates,
            error: "Multiple selector signatures decoded successfully.",
          };
        }

        return {
          index,
          target: action.target,
          value: action.value,
          calldata: normalized,
          selector,
          status: selectorResult.candidates.length > 0 ? "error" : "unknown",
          source: selectorResult.candidates.length > 0 ? "selector-db" : "raw",
          confidence: "none",
          candidates: selectorResult.candidates,
          error:
            selectorResult.candidates.length > 0
              ? "Known selector candidates did not decode this calldata."
              : "No selector match found.",
        };
      } catch (error) {
        return {
          index,
          target: action.target,
          value: action.value,
          calldata: normalized,
          selector,
          status: "error",
          source: "raw",
          confidence: "none",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );
}
