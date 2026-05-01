"use client";

import { useState, useCallback } from "react";
import { encodeFunctionData } from "viem";
import type { Abi, AbiFunction, AbiParameter } from "viem";

// ── Types ──────────────────────────────────────────────────────────────

export interface ActionItem {
  target: string;
  value: string;
  calldata: string;
}

interface BuildState {
  abiJson: string;
  parsedAbi: AbiFunction[] | null;
  selectedFunction: string;
  params: Record<string, unknown>;
  encodeError: string;
}

interface ActionCardState {
  mode: "build" | "raw";
  collapsed: boolean;
  build: BuildState;
}

// ── Helpers ────────────────────────────────────────────────────────────

function parseAbiJson(raw: string): AbiFunction[] | null {
  try {
    const parsed = JSON.parse(raw);
    const abi: Abi = Array.isArray(parsed) ? parsed : parsed.abi ?? parsed;
    return abi.filter(
      (item): item is AbiFunction =>
        item.type === "function" &&
        item.stateMutability !== "view" &&
        item.stateMutability !== "pure"
    );
  } catch {
    return null;
  }
}

function createCardState(): ActionCardState {
  return {
    mode: "raw",
    collapsed: false,
    build: {
      abiJson: "",
      parsedAbi: null,
      selectedFunction: "",
      params: {},
      encodeError: "",
    },
  };
}

function getDefaultValue(param: AbiParameter): unknown {
  const t = param.type;
  if (t === "bool") return false;
  if (t.endsWith("[]")) return [];
  if (t === "tuple" && "components" in param && param.components) {
    const obj: Record<string, unknown> = {};
    for (const comp of param.components) {
      obj[comp.name ?? ""] = getDefaultValue(comp);
    }
    return obj;
  }
  return "";
}

function buildDefaultParams(fn: AbiFunction): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const input of fn.inputs) {
    params[input.name ?? ""] = getDefaultValue(input);
  }
  return params;
}

function coerceValue(type: string, value: unknown, param: AbiParameter): unknown {
  const t = type;

  if (t === "bool") {
    return Boolean(value);
  }

  if (t === "address") {
    return String(value || "");
  }

  if (/^u?int\d*$/.test(t)) {
    try {
      return BigInt(String(value || "0"));
    } catch {
      return BigInt(0);
    }
  }

  if (t === "string") {
    return String(value ?? "");
  }

  if (t === "bytes" || /^bytes\d+$/.test(t)) {
    const s = String(value || "0x");
    return s.startsWith("0x") ? s : "0x" + s;
  }

  if (t.endsWith("[]")) {
    const baseType = t.slice(0, -2);
    const arr = Array.isArray(value) ? value : [];
    // Build a synthetic param for the base type
    const baseParam: AbiParameter = {
      ...param,
      type: baseType,
      name: param.name,
    };
    return arr.map((item: unknown) => coerceValue(baseType, item, baseParam));
  }

  if (t === "tuple" && "components" in param && param.components) {
    const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const comp of param.components) {
      result[comp.name ?? ""] = coerceValue(comp.type, obj[comp.name ?? ""], comp);
    }
    return result;
  }

  return String(value ?? "");
}

// ── Param Field Renderer ───────────────────────────────────────────────

function ParamField({
  param,
  value,
  onChange,
  depth = 0,
}: {
  param: AbiParameter;
  value: unknown;
  onChange: (v: unknown) => void;
  depth?: number;
}) {
  const t = param.type;
  const label = param.name || "(unnamed)";

  // Bool toggle
  if (t === "bool") {
    return (
      <div className={depth > 0 ? "ml-4" : ""}>
        <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
          {label} <span className="text-white/20 normal-case">{t}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`px-3 py-1.5 text-sm border ${
            value
              ? "border-white/30 text-white bg-white/10"
              : "border-white/10 text-white/40 bg-white/5"
          } hover:border-white/40`}
        >
          {value ? "true" : "false"}
        </button>
      </div>
    );
  }

  // Array types
  if (t.endsWith("[]")) {
    const baseType = t.slice(0, -2);
    const arr = Array.isArray(value) ? value : [];
    const baseParam: AbiParameter = {
      ...param,
      type: baseType,
      name: "",
    };

    return (
      <div className={depth > 0 ? "ml-4" : ""}>
        <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
          {label} <span className="text-white/20 normal-case">{t}</span>
        </div>
        <div className="border border-white/10 p-3 space-y-2">
          {arr.map((item: unknown, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <ParamField
                  param={{ ...baseParam, name: `[${i}]` }}
                  value={item}
                  onChange={(v) => {
                    const next = [...arr];
                    next[i] = v;
                    onChange(next);
                  }}
                  depth={depth + 1}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = arr.filter((_: unknown, idx: number) => idx !== i);
                  onChange(next);
                }}
                className="mt-5 text-xs text-white/30 hover:text-white/60 px-2 py-1 border border-white/10 hover:border-white/20"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              onChange([...arr, getDefaultValue(baseParam)]);
            }}
            className="text-xs text-white/40 hover:text-white/60 border border-white/10 hover:border-white/20 px-2 py-1"
          >
            + Add item
          </button>
        </div>
      </div>
    );
  }

  // Tuple
  if (t === "tuple" && "components" in param && param.components) {
    const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return (
      <div className={depth > 0 ? "ml-4" : ""}>
        <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
          {label} <span className="text-white/20 normal-case">tuple</span>
        </div>
        <div className="border border-white/10 p-3 space-y-3">
          {param.components.map((comp) => (
            <ParamField
              key={comp.name}
              param={comp}
              value={obj[comp.name ?? ""]}
              onChange={(v) => {
                onChange({ ...obj, [comp.name ?? ""]: v });
              }}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  // Hint for specific types
  let placeholder = "";
  if (t === "address") placeholder = "0x...";
  else if (/^u?int\d*$/.test(t)) placeholder = "0";
  else if (t === "bytes" || /^bytes\d+$/.test(t)) placeholder = "0x...";
  else if (t === "string") placeholder = "";

  return (
    <div className={depth > 0 ? "ml-4" : ""}>
      <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
        {label} <span className="text-white/20 normal-case">{t}</span>
      </div>
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none placeholder:text-white/20"
      />
    </div>
  );
}

// ── Single Action Card ─────────────────────────────────────────────────

function ActionCard({
  index,
  action,
  cardState,
  onActionChange,
  onCardStateChange,
  onRemove,
  canRemove,
}: {
  index: number;
  action: ActionItem;
  cardState: ActionCardState;
  onActionChange: (a: ActionItem) => void;
  onCardStateChange: (s: ActionCardState) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { mode, collapsed, build } = cardState;

  // Encode calldata from build state
  const tryEncode = useCallback(
    (b: BuildState, fn: AbiFunction | undefined): { calldata: string; error: string } => {
      if (!fn) return { calldata: "0x", error: "" };
      try {
        const args = fn.inputs.map((input) =>
          coerceValue(input.type, b.params[input.name ?? ""], input)
        );
        const encoded = encodeFunctionData({
          abi: [fn] as Abi,
          functionName: fn.name,
          args,
        });
        return { calldata: encoded, error: "" };
      } catch (err) {
        return { calldata: "0x", error: err instanceof Error ? err.message : String(err) };
      }
    },
    []
  );

  const handleAbiChange = (abiJson: string) => {
    const parsed = parseAbiJson(abiJson);
    const newBuild: BuildState = {
      ...build,
      abiJson,
      parsedAbi: parsed,
      selectedFunction: "",
      params: {},
      encodeError: parsed === null && abiJson.trim() !== "" ? "Invalid ABI JSON" : "",
    };
    onCardStateChange({ ...cardState, build: newBuild });
  };

  const handleFunctionSelect = (fnName: string) => {
    const fn = build.parsedAbi?.find((f) => f.name === fnName);
    const params = fn ? buildDefaultParams(fn) : {};
    const newBuild: BuildState = { ...build, selectedFunction: fnName, params, encodeError: "" };

    if (fn) {
      const { calldata, error } = tryEncode(newBuild, fn);
      newBuild.encodeError = error;
      onCardStateChange({ ...cardState, build: newBuild });
      onActionChange({ ...action, calldata });
    } else {
      onCardStateChange({ ...cardState, build: newBuild });
    }
  };

  const handleParamChange = (name: string, value: unknown) => {
    const newParams = { ...build.params, [name]: value };
    const newBuild: BuildState = { ...build, params: newParams };
    const fn = build.parsedAbi?.find((f) => f.name === build.selectedFunction);
    if (fn) {
      const { calldata, error } = tryEncode({ ...newBuild }, fn);
      newBuild.encodeError = error;
      onCardStateChange({ ...cardState, build: newBuild });
      onActionChange({ ...action, calldata });
    } else {
      onCardStateChange({ ...cardState, build: newBuild });
    }
  };

  const selectedFn = build.parsedAbi?.find((f) => f.name === build.selectedFunction);

  return (
    <div className="border border-white/10">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          type="button"
          onClick={() => onCardStateChange({ ...cardState, collapsed: !collapsed })}
          className="flex items-center gap-3 text-left"
        >
          <span className="font-mono text-xs text-white/30 w-6">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-sm text-white">
            {action.target
              ? action.target.slice(0, 6) + "..." + action.target.slice(-4)
              : "New Action"}
          </span>
          <span className="text-xs text-white/20">
            {collapsed ? "+" : "-"}
          </span>
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-white/30 hover:text-white/60"
          >
            Remove
          </button>
        )}
      </div>

      {/* Card body */}
      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Target address - always visible */}
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
              Target Address
            </div>
            <input
              type="text"
              value={action.target}
              onChange={(e) => onActionChange({ ...action, target: e.target.value })}
              placeholder="0x..."
              className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none placeholder:text-white/20"
            />
          </div>

          {/* ETH value - always visible */}
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
              Value (ETH)
            </div>
            <input
              type="text"
              value={action.value}
              onChange={(e) => onActionChange({ ...action, value: e.target.value })}
              placeholder="0"
              className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none placeholder:text-white/20"
            />
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-white/10">
            <button
              type="button"
              onClick={() => onCardStateChange({ ...cardState, mode: "build" })}
              className={`px-4 py-2 text-xs uppercase tracking-wider border-b-2 -mb-px ${
                mode === "build"
                  ? "border-white text-white"
                  : "border-transparent text-white/30 hover:text-white/50"
              }`}
            >
              Build
            </button>
            <button
              type="button"
              onClick={() => onCardStateChange({ ...cardState, mode: "raw" })}
              className={`px-4 py-2 text-xs uppercase tracking-wider border-b-2 -mb-px ${
                mode === "raw"
                  ? "border-white text-white"
                  : "border-transparent text-white/30 hover:text-white/50"
              }`}
            >
              Raw
            </button>
          </div>

          {/* Build mode */}
          {mode === "build" && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
                  ABI JSON
                </div>
                <textarea
                  value={build.abiJson}
                  onChange={(e) => handleAbiChange(e.target.value)}
                  placeholder='Paste ABI JSON array, e.g. [{"type":"function",...}]'
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none placeholder:text-white/20 resize-y"
                />
                {build.abiJson.trim() !== "" && build.parsedAbi === null && (
                  <div className="text-xs text-white/40 mt-1">
                    Could not parse ABI. Paste a valid JSON array.
                  </div>
                )}
              </div>

              {build.parsedAbi && build.parsedAbi.length > 0 && (
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
                    Function
                  </div>
                  <select
                    value={build.selectedFunction}
                    onChange={(e) => handleFunctionSelect(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none"
                  >
                    <option value="">Select a function...</option>
                    {build.parsedAbi.map((fn) => (
                      <option key={fn.name} value={fn.name}>
                        {fn.name}({fn.inputs.map((i) => i.type).join(", ")})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {build.parsedAbi &&
                build.parsedAbi.length === 0 &&
                build.abiJson.trim() !== "" && (
                  <div className="text-xs text-white/30">
                    No writable functions found in this ABI.
                  </div>
                )}

              {selectedFn && selectedFn.inputs.length > 0 && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div className="text-xs text-white/30 uppercase tracking-wider">
                    Parameters
                  </div>
                  {selectedFn.inputs.map((input) => (
                    <ParamField
                      key={input.name}
                      param={input}
                      value={build.params[input.name ?? ""]}
                      onChange={(v) => handleParamChange(input.name ?? "", v)}
                    />
                  ))}
                </div>
              )}

              {build.encodeError && (
                <div className="text-xs text-white/40 border border-white/10 px-3 py-2">
                  Encode error: {build.encodeError}
                </div>
              )}
            </div>
          )}

          {/* Raw mode */}
          {mode === "raw" && (
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
                Calldata (hex)
              </div>
              <textarea
                value={action.calldata}
                onChange={(e) => onActionChange({ ...action, calldata: e.target.value })}
                placeholder="0x"
                rows={3}
                className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none placeholder:text-white/20 resize-y"
              />
            </div>
          )}

          {/* Encoded calldata preview */}
          {action.calldata && action.calldata !== "0x" && (
            <CalldataPreview data={action.calldata} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Calldata Preview ───────────────────────────────────────────────────

function CalldataPreview({ data }: { data: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = data.length > 66;

  return (
    <div className="border-t border-white/10 pt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-white/30 uppercase tracking-wider">
          Encoded Calldata
        </span>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-white/30 hover:text-white/50"
          >
            {expanded ? "Collapse" : "Expand"} ({data.length} chars)
          </button>
        )}
      </div>
      <pre className="font-mono text-xs text-white/40 break-all whitespace-pre-wrap bg-white/[0.03] px-3 py-2 max-h-40 overflow-y-auto">
        {isLong && !expanded ? data.slice(0, 66) + "..." : data}
      </pre>
    </div>
  );
}

// ── Main ActionBuilder ─────────────────────────────────────────────────

export function ActionBuilder({
  actions,
  onChange,
}: {
  actions: ActionItem[];
  onChange: (actions: ActionItem[]) => void;
}) {
  const [cardStates, setCardStates] = useState<ActionCardState[]>(() =>
    actions.map(() => createCardState())
  );
  const visibleCardStates = actions.map(
    (_action, index) => cardStates[index] ?? createCardState()
  );

  const updateAction = (index: number, action: ActionItem) => {
    const next = [...actions];
    next[index] = action;
    onChange(next);
  };

  const updateCardState = (index: number, state: ActionCardState) => {
    const next = [...visibleCardStates];
    next[index] = state;
    setCardStates(next);
  };

  const removeAction = (index: number) => {
    if (actions.length <= 1) return;
    onChange(actions.filter((_, i) => i !== index));
    setCardStates(visibleCardStates.filter((_, i) => i !== index));
  };

  const addAction = () => {
    onChange([...actions, { target: "", value: "0", calldata: "0x" }]);
    setCardStates([...visibleCardStates, createCardState()]);
  };

  return (
    <div className="space-y-3">
      {actions.map((action, i) => (
        <ActionCard
          key={i}
          index={i}
          action={action}
          cardState={visibleCardStates[i]}
          onActionChange={(a) => updateAction(i, a)}
          onCardStateChange={(s) => updateCardState(i, s)}
          onRemove={() => removeAction(i)}
          canRemove={actions.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={addAction}
        className="w-full border border-dashed border-white/10 hover:border-white/20 px-4 py-3 text-sm text-white/30 hover:text-white/50"
      >
        + Add Action
      </button>
    </div>
  );
}
