"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

/**
 * Reusable confirm/prompt dialog — replaces native window.confirm() and window.prompt().
 *
 * Two modes:
 *   - "confirm": shows a message with Confirm/Cancel buttons
 *   - "prompt":  shows a message + text input with Submit/Cancel buttons
 *
 * Usage:
 *   const confirm = useConfirmDialog();
 *   const ok = await confirm({ title: "Delete?", description: "Are you sure?", confirmLabel: "Delete", danger: true });
 *   if (ok) doDelete();
 *
 *   const val = await confirm.prompt({ title: "Pay", description: "Enter amount", confirmLabel: "Pay" });
 *   if (val) doPay(Number(val));
 */

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PromptOptions = {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
};

type DialogState =
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void }
  | null;

export function useConfirmDialog() {
  const [state, setState] = useState<DialogState>(null);
  const [promptValue, setPromptValue] = useState("");

  function confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", opts, resolve });
    });
  }

  function prompt(opts: PromptOptions): Promise<string | null> {
    setPromptValue(opts.defaultValue ?? "");
    return new Promise<string | null>((resolve) => {
      setState({ kind: "prompt", opts, resolve });
    });
  }

  function close(result: boolean | string | null) {
    if (state?.kind === "confirm") {
      state.resolve(result as boolean);
    } else if (state?.kind === "prompt") {
      state.resolve(result as string | null);
    }
    setState(null);
  }

  const dialog = state && (
    <AlertDialog open onOpenChange={(o) => { if (!o) close(state.kind === "confirm" ? false : null); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{state.opts.title}</AlertDialogTitle>
          {state.opts.description && (
            <AlertDialogDescription className="whitespace-pre-line">
              {state.opts.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {state.kind === "prompt" && (
          <Input
            autoFocus
            type={state.opts.type ?? "text"}
            value={promptValue}
            min={state.opts.min}
            max={state.opts.max}
            placeholder={state.opts.placeholder}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                close(promptValue);
              }
            }}
          />
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(state.kind === "confirm" ? false : null)}>
            {state.opts.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          {state.kind === "confirm" ? (
            <AlertDialogAction
              className={state.opts.danger ? "bg-red-600 hover:bg-red-700 text-white" : "bg-yellow-400 hover:bg-yellow-500 text-yellow-950"}
              onClick={(e) => { e.preventDefault(); close(true); }}
            >
              {state.opts.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950"
              onClick={(e) => { e.preventDefault(); close(promptValue); }}
            >
              {state.opts.confirmLabel ?? "Submit"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, prompt, dialog };
}
