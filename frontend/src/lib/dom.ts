/**
 * Safe DOM manipulation helpers for temporary nodes.
 * Prevents Safari NotFoundError when removing nodes that may already be detached.
 */

export function safeRemove(node: Node | null | undefined): void {
  if (!node) return;

  try {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  } catch (e) {
    // Ignore removal errors - node may already be detached
    // This prevents Safari NotFoundError during cleanup
  }
}

export function appendHiddenNode(node: Node): HTMLElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1px';
  container.style.height = '1px';
  container.style.overflow = 'hidden';
  container.appendChild(node);
  document.body.appendChild(container);
  return container;
}

export function downloadBlob(blob: Blob, filename: string): void {
  // Create temporary link for download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;

  // Append to body (required for Firefox)
  document.body.appendChild(link);

  // Programmatically click
  link.click();

  // Cleanup
  URL.revokeObjectURL(link.href);
  safeRemove(link);
}

export function downloadText(text: string, filename: string, contentType: string = "text/plain"): void {
  const blob = new Blob([text], { type: contentType });
  downloadBlob(blob, filename);
}

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard.writeText(text)
    .then(() => true)
    .catch(async () => {
      // Fallback for older browsers or when clipboard API is not available
      const textarea = document.createElement('textarea');
      textarea.value = text;

      // Prevent scrolling to bottom of page in MS Edge
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';

      document.body.appendChild(textarea);
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        if (!successful) throw new Error('Copy command failed');
        return true;
      } catch (fallbackErr) {
        return false;
      } finally {
        safeRemove(textarea);
      }
    });
}
