function safeRemove(node: { parentNode: Node | null; remove?: () => void } | null | undefined) {
  if (!node) return;

  try {
    const parent = node.parentNode;
    if (parent && parent.contains(node as Node)) {
      parent.removeChild(node as Node);
      return;
    }

    node.remove?.();
  } catch {
    // Best effort only — the caller already handled the user-visible action.
  }
}

function appendHiddenNode<T extends HTMLElement>(node: T) {
  const parent = document.body || document.documentElement;
  if (!node.isConnected) parent.appendChild(node);
  return node;
}

function revokeObjectUrl(url: string, delayMs: number) {
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup failures.
    }
  }, delayMs);
}

export function downloadBlob(blob: Blob, filename: string, revokeDelayMs = 1000) {
  if (typeof document === "undefined") return false;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.position = "fixed";
  anchor.style.top = "0";
  anchor.style.left = "0";
  anchor.style.width = "1px";
  anchor.style.height = "1px";
  anchor.style.opacity = "0";
  anchor.style.pointerEvents = "none";

  try {
    appendHiddenNode(anchor);
    anchor.click();
    return true;
  } finally {
    safeRemove(anchor);
    revokeObjectUrl(url, revokeDelayMs);
  }
}

export function downloadText(text: string, filename: string, mimeType = "text/plain", revokeDelayMs = 1000) {
  return downloadBlob(new Blob([text], { type: mimeType }), filename, revokeDelayMs);
}

export async function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the temporary textarea below.
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  try {
    appendHiddenNode(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    safeRemove(textarea);
  }
}
