"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  writingError,
  writingFreshRequest,
  writingInput,
  writingRequest,
  type WritingDraft,
  type WritingInput,
} from "../studio-writing-model";
import { registerStudioWritingSession } from "../studio-edit-flush";
import { rebaseWritingInput } from "./writing-rebase";
import { createWritingSaveController } from "./writing-save-controller";
import {
  sameWritingCacheScope,
  writingCacheScope,
  type WritingCacheScope,
} from "./writing-cache-scope";

type Options = {
  url: string;
  storageKey: string;
  cacheScope: WritingCacheScope | null;
  busy: string;
  blocked: boolean;
  composing: boolean;
  recovering: boolean;
  draft: WritingDraft | null;
  input: WritingInput;
  dirty: boolean;
  composingRef: RefObject<boolean>;
  latest: RefObject<{ draft: WritingDraft | null; input: WritingInput }>;
  alive: RefObject<boolean>;
  operationPending: RefObject<boolean>;
  setBusy: (value: string) => void;
  setError: (value: string) => void;
  setConflict: (value: WritingDraft) => void;
  accept: (draft: WritingDraft, input: WritingInput) => void;
};

export function useWritingSave(options: Options) {
  const live = useRef(options);
  const [failure, setFailure] = useState<WritingDraft | null>(null);
  const failed = failure !== null && failure === options.draft;
  const failedRef = useRef(false);
  const scopeBlocked = useRef(false);
  const [scopeChanged, setScopeChanged] = useState(false);
  const controller = useRef<ReturnType<
    typeof createWritingSaveController
  > | null>(null);
  const cache = useCallback(() => {
    const saver = controller.current;
    const { draft, input } = live.current.latest.current;
    // The recovery banner owns an older copy until the user explicitly resolves it.
    if (!saver || !draft || !live.current.storageKey || live.current.recovering)
      return;
    try {
      if (saver.dirty())
        sessionStorage.setItem(
          live.current.storageKey,
          JSON.stringify({ input, version: draft.version }),
        );
      else sessionStorage.removeItem(live.current.storageKey);
    } catch {
      /* Denied or full storage does not authorize navigation or claim a server save. */
    }
  }, []);
  useLayoutEffect(() => {
    live.current = options;
    if (failure !== options.draft || !options.dirty) failedRef.current = false;
    if (controller.current !== null) return;
    controller.current = createWritingSaveController({
      read: () => ({
        ...live.current.latest.current,
        blocked:
          !live.current.alive.current ||
          !live.current.cacheScope ||
          scopeBlocked.current ||
          live.current.blocked ||
          live.current.composingRef.current,
      }),
      acquire: () => {
        if (live.current.operationPending.current || live.current.busy)
          return false;
        live.current.operationPending.current = true;
        live.current.setBusy("save");
        live.current.setError("");
        return true;
      },
      release: () => {
        live.current.operationPending.current = false;
        if (live.current.alive.current) live.current.setBusy("");
      },
      write: async (input, version, keepalive) => {
        const { url, cacheScope } = live.current;
        const draftId = live.current.latest.current.draft?.id;
        try {
          const result = await writingRequest<{ draft: WritingDraft }>(url, {
            method: "PATCH",
            body: JSON.stringify({
              ...input,
              expectedVersion: version,
              expectedCacheScope: cacheScope,
            }),
            keepalive,
          });
          return result.draft;
        } catch (cause) {
          const error = cause as {
            status?: number;
            code?: string;
            current?: WritingDraft;
          };
          // Normal member DTOs deliberately omit entity bodies on errors. Read
          // the same authenticated draft, without retrying the conditional write.
          if (
            error.status !== 409 ||
            error.code !== "version_conflict" ||
            error.current ||
            keepalive
          )
            throw cause;
          let result: { draft: WritingDraft; cacheScope?: unknown };
          try {
            result = await writingFreshRequest(url);
          } catch {
            throw cause;
          }
          if (
            !sameWritingCacheScope(
              cacheScope,
              writingCacheScope(result.cacheScope),
            )
          )
            throw Object.assign(
              new Error(
                "账号或工作空间已切换，当前输入已保留。请重新打开稿件后再保存。",
              ),
              { status: 409, code: "edit_scope_changed" },
            );
          if (
            result.draft.id === draftId &&
            live.current.latest.current.draft?.id === draftId
          )
            error.current = result.draft;
          throw cause;
        }
      },
      accept: (draft, input) => {
        if (!live.current.alive.current) return;
        failedRef.current = false;
        setFailure(null);
        live.current.accept(draft, input);
      },
      failed: (cause) => {
        if (!live.current.alive.current) return;
        failedRef.current = true;
        setFailure(live.current.latest.current.draft);
        live.current.setError(writingError(cause));
        const error = cause as {
          status?: number;
          code?: string;
          current?: WritingDraft;
        };
        if (error?.code === "edit_scope_changed") {
          scopeBlocked.current = true;
          setScopeChanged(true);
          cache();
        }
        const current = error.current;
        const draft = live.current.latest.current.draft;
        if (error.status === 409 && current && draft && current.id === draft.id)
          live.current.setConflict(current);
      },
    });
  });

  useEffect(() => {
    const saver = controller.current;
    if (!saver) return;
    return registerStudioWritingSession({
      flush: () => saver.flush(),
      dirty: () =>
        saver.dirty() ||
        live.current.composingRef.current ||
        live.current.recovering,
      cache,
    });
  }, [cache]);
  useEffect(() => {
    const saver = controller.current;
    if (
      !saver ||
      !saver.dirty() ||
      !options.cacheScope ||
      scopeChanged ||
      options.busy ||
      options.blocked ||
      options.composing ||
      failed
    )
      return;
    const timer = window.setTimeout(() => {
      void saver.flush();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    options.input,
    options.draft,
    options.cacheScope,
    scopeChanged,
    options.busy,
    options.blocked,
    options.composing,
    failed,
  ]);
  useEffect(() => {
    const saver = controller.current;
    if (!saver) return;
    let refreshing = false;
    const scope = new AbortController();
    const refresh = async () => {
      if (
        refreshing ||
        document.visibilityState === "hidden" ||
        saver.pending ||
        live.current.operationPending.current ||
        live.current.blocked ||
        scopeBlocked.current ||
        !live.current.cacheScope ||
        live.current.composingRef.current ||
        !live.current.latest.current.draft
      )
        return;
      refreshing = true;
      try {
        const result = await writingFreshRequest<{
          draft: WritingDraft;
          cacheScope?: unknown;
        }>(live.current.url, {
          signal: scope.signal,
        });
        if (
          scope.signal.aborted ||
          saver.pending ||
          live.current.operationPending.current ||
          live.current.blocked ||
          live.current.composingRef.current
        )
          return;
        if (
          !sameWritingCacheScope(
            live.current.cacheScope,
            writingCacheScope(result.cacheScope),
          )
        ) {
          cache();
          scopeBlocked.current = true;
          setScopeChanged(true);
          live.current.setError(
            "账号或工作空间已切换，当前输入已保留。请重新打开稿件后再保存。",
          );
          return;
        }
        const current = live.current.latest.current;
        if (
          !current.draft ||
          result.draft.id !== current.draft.id ||
          result.draft.version <= current.draft.version
        )
          return;
        const input = rebaseWritingInput(
          writingInput(current.draft),
          current.input,
          writingInput(result.draft),
        );
        if (!input) {
          cache();
          live.current.setConflict(result.draft);
          live.current.setError(
            "服务器已有更新版本；当前输入已保留，请比较后再保存",
          );
          return;
        }
        failedRef.current = false;
        setFailure(null);
        live.current.accept(result.draft, input);
      } catch {
        /* Read-only background checks never turn a transient read error into a save conflict. */
      } finally {
        refreshing = false;
      }
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(() => {
      void refresh();
    }, 15000);
    return () => {
      scope.abort();
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [cache]);
  useEffect(() => {
    const saver = controller.current;
    if (!saver) return;
    const bestEffort = () => {
      cache();
      if (
        !saver.dirty() ||
        saver.pending ||
        failedRef.current ||
        live.current.blocked ||
        scopeBlocked.current ||
        !live.current.cacheScope ||
        live.current.composingRef.current
      )
        return;
      // Fetch keepalive has a shared 64KiB budget. Large drafts retain local recovery only.
      const { draft, input } = live.current.latest.current;
      if (
        new Blob([
          JSON.stringify({
            ...input,
            expectedVersion: draft?.version,
            expectedCacheScope: live.current.cacheScope,
          }),
        ]).size <= 60000
      )
        void saver.flush(true);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!saver.dirty() && !live.current.composingRef.current) return;
      bestEffort();
      event.preventDefault();
      event.returnValue = "";
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") bestEffort();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", bestEffort);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cache();
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", bestEffort);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [cache]);
  return {
    save: () => controller.current?.flush() || Promise.resolve(false),
    status: scopeChanged
      ? "账号已切换，请重新打开稿件"
      : !options.cacheScope
        ? "请重新确认稿件账号"
        : options.busy === "save"
          ? "保存中…"
          : options.blocked
            ? "请先比较或恢复输入"
            : failed && options.dirty
              ? "保存失败，输入已保留"
              : options.dirty
                ? "未保存"
                : "已保存",
  };
}
