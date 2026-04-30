"use client";

import { useState } from "react";
import { encodeFunctionData } from "viem";
import type { Abi, AbiFunction, AbiParameter } from "viem";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Braces,
  Check,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CalldataAction } from "@/lib/mock-proposals";

type CallMode = "abi" | "raw";

type NormalizedFunction = {
  key: string;
  label: string;
  fn: AbiFunction;
};

type AbiParseResult = {
  functions: NormalizedFunction[];
  error: string;
};

type CallBuildState = {
  mode: CallMode;
  abiJson: string;
  functions: NormalizedFunction[];
  selectedFunction: string;
  params: Record<string, unknown>;
  error: string;
};

const emptyBuildState: CallBuildState = {
  mode: "abi",
  abiJson: "",
  functions: [],
  selectedFunction: "",
  params: {},
  error: "",
};

function selectorFromCalldata(calldata: string) {
  return calldata.startsWith("0x") && calldata.length >= 10
    ? calldata.slice(0, 10)
    : "0x";
}

function shortAddress(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function createCall(id = "call-1"): CalldataAction {
  return {
    id,
    target: "",
    value: "0",
    calldata: "0x",
  };
}

function getNextCallId(actions: CalldataAction[], prefix = "call") {
  let index = actions.length + 1;
  let id = `${prefix}-${index}`;

  while (actions.some((action) => action.id === id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }

  return id;
}

function isHexCalldata(value: string) {
  return /^0x([0-9a-fA-F]{2})*$/.test(value.trim());
}

function isAddressOrEns(value: string) {
  const trimmed = value.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(trimmed);
}

function parseAbiJson(raw: string): AbiParseResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { functions: [], error: "" };
  }

  try {
    const parsed = JSON.parse(trimmed);
    const abi = Array.isArray(parsed) ? parsed : parsed?.abi;

    if (!Array.isArray(abi)) {
      return { functions: [], error: "ABI must be a JSON array or an object with an abi array." };
    }

    const functions = (abi as Abi)
      .filter(
        (item): item is AbiFunction =>
          item.type === "function" &&
          item.stateMutability !== "view" &&
          item.stateMutability !== "pure"
      )
      .map((fn, index) => {
        const inputTypes = fn.inputs.map((input) => input.type).join(", ");
        const mutability = fn.stateMutability ? ` ${fn.stateMutability}` : "";

        return {
          key: `${fn.name}(${inputTypes})-${index}`,
          label: `${fn.name}(${inputTypes})${mutability}`,
          fn,
        };
      });

    if (functions.length === 0) {
      return { functions, error: "No writable functions found in this ABI." };
    }

    return { functions, error: "" };
  } catch {
    return { functions: [], error: "ABI JSON could not be parsed." };
  }
}

function getDefaultValue(param: AbiParameter): unknown {
  if (param.type === "bool") return false;
  if (param.type.endsWith("[]")) return [];
  if (param.type === "tuple" && "components" in param && param.components) {
    return Object.fromEntries(
      param.components.map((component) => [
        component.name ?? "",
        getDefaultValue(component),
      ])
    );
  }
  return "";
}

function buildDefaultParams(fn: AbiFunction): Record<string, unknown> {
  return Object.fromEntries(
    fn.inputs.map((input, index) => [
      input.name || `arg${index}`,
      getDefaultValue(input),
    ])
  );
}

function coerceValue(type: string, value: unknown, param: AbiParameter): unknown {
  if (type === "bool") return Boolean(value);
  if (type === "address") return String(value || "");
  if (/^u?int\d*$/.test(type)) return BigInt(String(value || "0"));
  if (type === "string") return String(value ?? "");

  if (type === "bytes" || /^bytes\d+$/.test(type)) {
    const raw = String(value || "0x");
    return raw.startsWith("0x") ? raw : `0x${raw}`;
  }

  if (type.endsWith("[]")) {
    const baseType = type.slice(0, -2);
    const baseParam: AbiParameter = { ...param, type: baseType };
    const items = Array.isArray(value) ? value : [];

    return items.map((item) => coerceValue(baseType, item, baseParam));
  }

  if (type === "tuple" && "components" in param && param.components) {
    const objectValue =
      value && typeof value === "object" ? (value as Record<string, unknown>) : {};

    return param.components.map((component, index) =>
      coerceValue(
        component.type,
        objectValue[component.name || `arg${index}`],
        component
      )
    );
  }

  return String(value ?? "");
}

function encodeFromState(state: CallBuildState) {
  const selected = state.functions.find(
    (item) => item.key === state.selectedFunction
  );

  if (!selected) {
    return { calldata: "0x", error: "" };
  }

  try {
    const args = selected.fn.inputs.map((input, index) =>
      coerceValue(input.type, state.params[input.name || `arg${index}`], input)
    );

    return {
      calldata: encodeFunctionData({
        abi: [selected.fn] as Abi,
        functionName: selected.fn.name,
        args,
      }),
      error: "",
    };
  } catch (error) {
    return {
      calldata: "0x",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function ParamField({
  param,
  value,
  onChange,
  depth = 0,
  index = 0,
}: {
  param: AbiParameter;
  value: unknown;
  onChange: (value: unknown) => void;
  depth?: number;
  index?: number;
}) {
  const label = param.name || `arg${index}`;
  const labelId = `${label}-${param.type}-${depth}-${index}`;

  if (param.type === "bool") {
    return (
      <div className={cn("grid gap-2", depth > 0 && "pl-3")}>
        <Label htmlFor={labelId}>
          {label} <span className="font-mono text-muted-foreground">{param.type}</span>
        </Label>
        <Button
          id={labelId}
          type="button"
          variant={value ? "default" : "outline"}
          className="w-fit"
          onClick={() => onChange(!value)}
        >
          {value ? <Check className="size-4" /> : null}
          {value ? "true" : "false"}
        </Button>
      </div>
    );
  }

  if (param.type.endsWith("[]")) {
    const baseType = param.type.slice(0, -2);
    const baseParam: AbiParameter = { ...param, name: "", type: baseType };
    const items = Array.isArray(value) ? value : [];

    return (
      <div className={cn("grid gap-2", depth > 0 && "pl-3")}>
        <div className="flex items-center justify-between gap-3">
          <Label>
            {label}{" "}
            <span className="font-mono text-muted-foreground">{param.type}</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...items, getDefaultValue(baseParam)])}
          >
            <Plus className="size-3.5" />
            Item
          </Button>
        </div>
        <div className="grid gap-3 rounded-lg border p-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items.</p>
          ) : null}
          {items.map((item, itemIndex) => (
            <div key={itemIndex} className="grid gap-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <ParamField
                    param={{ ...baseParam, name: `[${itemIndex}]` }}
                    value={item}
                    depth={depth + 1}
                    index={itemIndex}
                    onChange={(nextValue) => {
                      const next = [...items];
                      next[itemIndex] = nextValue;
                      onChange(next);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${label} item ${itemIndex + 1}`}
                  onClick={() =>
                    onChange(items.filter((_, current) => current !== itemIndex))
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {itemIndex < items.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (param.type === "tuple" && "components" in param && param.components) {
    const objectValue =
      value && typeof value === "object" ? (value as Record<string, unknown>) : {};

    return (
      <div className={cn("grid gap-2", depth > 0 && "pl-3")}>
        <Label>
          {label} <span className="font-mono text-muted-foreground">tuple</span>
        </Label>
        <div className="grid gap-3 rounded-lg border p-3">
          {param.components.map((component, componentIndex) => {
            const componentKey = component.name || `arg${componentIndex}`;

            return (
              <ParamField
                key={`${componentKey}-${componentIndex}`}
                param={component}
                value={objectValue[componentKey]}
                depth={depth + 1}
                index={componentIndex}
                onChange={(nextValue) =>
                  onChange({ ...objectValue, [componentKey]: nextValue })
                }
              />
            );
          })}
        </div>
      </div>
    );
  }

  const placeholder =
    param.type === "address"
      ? "0x..."
      : /^u?int\d*$/.test(param.type)
        ? "0"
        : param.type === "bytes" || /^bytes\d+$/.test(param.type)
          ? "0x..."
          : "";

  return (
    <div className={cn("grid gap-2", depth > 0 && "pl-3")}>
      <Label htmlFor={labelId}>
        {label} <span className="font-mono text-muted-foreground">{param.type}</span>
      </Label>
      <Input
        id={labelId}
        value={String(value ?? "")}
        placeholder={placeholder}
        className="font-mono"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function CalldataPreview({ calldata }: { calldata: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = calldata.length > 130;

  return (
    <div className="grid gap-2 rounded-lg border bg-muted p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {selectorFromCalldata(calldata)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {Math.max(0, (calldata.length - 2) / 2)} bytes
          </span>
        </div>
        {isLong ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Collapse" : "Expand"}
          </Button>
        ) : null}
      </div>
      <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-6 text-muted-foreground">
        {isLong && !expanded ? `${calldata.slice(0, 130)}...` : calldata}
      </pre>
    </div>
  );
}

function CallEditor({
  index,
  action,
  state,
  canRemove,
  canMoveUp,
  canMoveDown,
  onChange,
  onStateChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  action: CalldataAction;
  state: CallBuildState;
  canRemove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (action: CalldataAction) => void;
  onStateChange: (state: CallBuildState) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const selectedFunction = state.functions.find(
    (item) => item.key === state.selectedFunction
  );
  const targetWarning =
    action.target.trim() && !isAddressOrEns(action.target)
      ? "Target should be an address or ENS name."
      : "";
  const calldataWarning =
    action.calldata.trim() && !isHexCalldata(action.calldata)
      ? "Calldata must be 0x-prefixed hex with full bytes."
      : "";

  function updateBuildState(nextState: CallBuildState) {
    const encoded = encodeFromState(nextState);
    onStateChange({ ...nextState, error: encoded.error || nextState.error });

    if (!encoded.error && encoded.calldata) {
      onChange({ ...action, calldata: encoded.calldata });
    }
  }

  function handleAbiChange(abiJson: string) {
    const result = parseAbiJson(abiJson);

    onStateChange({
      ...state,
      abiJson,
      functions: result.functions,
      selectedFunction: "",
      params: {},
      error: result.error,
    });
  }

  function handleFunctionChange(functionKey: string | null) {
    if (!functionKey) return;

    const selected = state.functions.find((item) => item.key === functionKey);
    const nextState = {
      ...state,
      selectedFunction: functionKey,
      params: selected ? buildDefaultParams(selected.fn) : {},
      error: "",
    };

    updateBuildState(nextState);
  }

  function handleParamChange(param: AbiParameter, paramIndex: number, value: unknown) {
    const paramKey = param.name || `arg${paramIndex}`;
    const nextState = {
      ...state,
      params: { ...state.params, [paramKey]: value },
      error: "",
    };

    updateBuildState(nextState);
  }

  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              Call {String(index + 1).padStart(2, "0")}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {selectorFromCalldata(action.calldata)}
            </Badge>
            <Badge variant="outline">{state.mode}</Badge>
          </div>
          <p className="mt-2 truncate text-sm text-muted-foreground">
            {action.target ? shortAddress(action.target) : "No target set"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Move call ${index + 1} up`}
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Move call ${index + 1} down`}
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <ArrowDown className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Duplicate call ${index + 1}`}
            onClick={onDuplicate}
          >
            <Copy className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Remove call ${index + 1}`}
            disabled={!canRemove}
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_160px]">
        <div className="grid gap-2">
          <Label htmlFor={`${action.id}-target`}>Target address or ENS</Label>
          <Input
            id={`${action.id}-target`}
            value={action.target}
            onChange={(event) =>
              onChange({ ...action, target: event.target.value })
            }
            className="font-mono"
            placeholder="0x... or contract.eth"
          />
          {targetWarning ? (
            <p className="text-xs text-muted-foreground">{targetWarning}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${action.id}-value`}>Value</Label>
          <Input
            id={`${action.id}-value`}
            value={action.value}
            onChange={(event) =>
              onChange({ ...action, value: event.target.value })
            }
            className="font-mono"
            placeholder="0"
          />
        </div>
      </div>

      <Tabs
        value={state.mode}
        onValueChange={(value) =>
          onStateChange({ ...state, mode: value as CallMode })
        }
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="abi">
            <Braces className="size-4" />
            ABI
          </TabsTrigger>
          <TabsTrigger value="raw">Raw calldata</TabsTrigger>
        </TabsList>

        <TabsContent value="abi" className="grid gap-4 pt-2">
          <div className="grid gap-2">
            <Label htmlFor={`${action.id}-abi`}>Contract ABI</Label>
            <Textarea
              id={`${action.id}-abi`}
              value={state.abiJson}
              onChange={(event) => handleAbiChange(event.target.value)}
              className="min-h-[120px] font-mono text-xs"
              placeholder='Paste ABI JSON array or {"abi":[...]}'
            />
          </div>

          {state.functions.length > 0 ? (
            <div className="grid gap-2">
              <Label>Function</Label>
              <Select
                value={state.selectedFunction}
                onValueChange={handleFunctionChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a writable function" />
                </SelectTrigger>
                <SelectContent>
                  {state.functions.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      <span className="font-mono">{item.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {selectedFunction ? (
            <div className="grid gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">Inputs</span>
                <Badge variant="outline">
                  {selectedFunction.fn.inputs.length} args
                </Badge>
              </div>
              {selectedFunction.fn.inputs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This function does not take inputs.
                </p>
              ) : null}
              {selectedFunction.fn.inputs.map((param, paramIndex) => (
                <ParamField
                  key={`${param.name || "arg"}-${paramIndex}`}
                  param={param}
                  value={state.params[param.name || `arg${paramIndex}`]}
                  index={paramIndex}
                  onChange={(nextValue) =>
                    handleParamChange(param, paramIndex, nextValue)
                  }
                />
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="raw" className="grid gap-2 pt-2">
          <Label htmlFor={`${action.id}-calldata`}>Calldata</Label>
          <Textarea
            id={`${action.id}-calldata`}
            value={action.calldata}
            onChange={(event) =>
              onChange({ ...action, calldata: event.target.value })
            }
            className="min-h-[160px] font-mono text-xs"
            placeholder="0x"
          />
        </TabsContent>
      </Tabs>

      {state.error || calldataWarning ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error || calldataWarning}</AlertDescription>
        </Alert>
      ) : null}

      <CalldataPreview calldata={action.calldata || "0x"} />
    </div>
  );
}

export function CalldataCallBuilder({
  actions,
  onChange,
  className,
}: {
  actions: CalldataAction[];
  onChange: (actions: CalldataAction[]) => void;
  className?: string;
}) {
  const normalizedActions = actions.length > 0 ? actions : [createCall()];
  const [statesById, setStatesById] = useState<Record<string, CallBuildState>>(
    () =>
      Object.fromEntries(
        normalizedActions.map((action) => [action.id, { ...emptyBuildState }])
      )
  );
  const validCallCount = normalizedActions.filter(
    (action) =>
      action.target.trim() &&
      isAddressOrEns(action.target) &&
      isHexCalldata(action.calldata)
  ).length;

  function getState(actionId: string) {
    return statesById[actionId] ?? { ...emptyBuildState };
  }

  function setState(actionId: string, state: CallBuildState) {
    setStatesById((current) => ({ ...current, [actionId]: state }));
  }

  function updateAction(index: number, action: CalldataAction) {
    onChange(
      normalizedActions.map((current, currentIndex) =>
        currentIndex === index ? action : current
      )
    );
  }

  function addCall() {
    const call = createCall(getNextCallId(normalizedActions));
    setStatesById((current) => ({ ...current, [call.id]: { ...emptyBuildState } }));
    onChange([...normalizedActions, call]);
  }

  function duplicateCall(index: number) {
    const source = normalizedActions[index];
    const duplicate = {
      ...source,
      id: getNextCallId(normalizedActions, `${source.id}-copy`),
    };
    const next = [...normalizedActions];
    next.splice(index + 1, 0, duplicate);
    setStatesById((current) => ({
      ...current,
      [duplicate.id]: { ...getState(source.id) },
    }));
    onChange(next);
  }

  function removeCall(index: number) {
    if (normalizedActions.length <= 1) return;
    onChange(normalizedActions.filter((_, currentIndex) => currentIndex !== index));
  }

  function moveCall(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= normalizedActions.length) return;

    const next = [...normalizedActions];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{normalizedActions.length} calls</Badge>
            <Badge variant="outline">{validCallCount} valid</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Each proposal action has its own target, value, and calldata. Build
            from an ABI when possible, or paste raw calldata.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addCall}>
          <Plus className="size-4" />
          Add call
        </Button>
      </div>

      <div className="grid gap-4">
        {normalizedActions.map((action, index) => (
          <CallEditor
            key={action.id}
            index={index}
            action={action}
            state={getState(action.id)}
            canRemove={normalizedActions.length > 1}
            canMoveUp={index > 0}
            canMoveDown={index < normalizedActions.length - 1}
            onChange={(nextAction) => updateAction(index, nextAction)}
            onStateChange={(nextState) => setState(action.id, nextState)}
            onRemove={() => removeCall(index)}
            onDuplicate={() => duplicateCall(index)}
            onMoveUp={() => moveCall(index, -1)}
            onMoveDown={() => moveCall(index, 1)}
          />
        ))}
      </div>
    </div>
  );
}
