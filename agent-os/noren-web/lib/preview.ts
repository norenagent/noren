/**
 * Builds the document shown in the website preview.
 *
 * The agent returns plain files. We inline its stylesheet and script into one
 * HTML string, add a restrictive Content-Security-Policy as the very first
 * element in <head>, and render the result in an <iframe sandbox>. Nothing in
 * the preview can reach the network, other origins, cookies or the console
 * page, whatever the generated code tries.
 */

export type PreviewFile = { name: string; content: string };

/** Everything the preview may do: run inline code, nothing else. */
export const PREVIEW_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";

const MAX_PREVIEW_BYTES = 60 * 1024;

function escapeForTag(text: string, closing: string): string {
  // A generated file must not be able to close our wrapper tag early.
  return text.replace(new RegExp(`</${closing}`, "gi"), `<\\/${closing}`);
}

/** The page file to preview, or null when the agent did not build a site. */
export function findPage(files: PreviewFile[]): PreviewFile | null {
  return files.find((f) => f.name.toLowerCase() === "index.html") ?? null;
}

export function buildPreviewDocument(files: PreviewFile[]): string | null {
  const page = findPage(files);
  if (!page) return null;
  const byName = new Map(files.map((f) => [f.name, f.content]));
  let html = page.content;

  // Inline <link rel="stylesheet" href="x.css"> and <script src="x.js"></script>
  // that point at files the agent produced. Anything else is left alone and is
  // blocked by the CSP.
  html = html.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (tag, href: string) => {
    const css = byName.get(href);
    return css !== undefined && /stylesheet/i.test(tag) ? `<style>${escapeForTag(css, "style")}</style>` : tag;
  });
  html = html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (tag, src: string) => {
    const js = byName.get(src);
    return js !== undefined ? `<script>${escapeForTag(js, "script")}</script>` : tag;
  });

  const meta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}${meta}`);
  } else if (/<html[^>]*>/i.test(html)) {
    html = html.replace(/<html[^>]*>/i, (m) => `${m}<head>${meta}</head>`);
  } else {
    html = `<!doctype html><html><head>${meta}</head><body>${html}</body></html>`;
  }
  return html.length > MAX_PREVIEW_BYTES ? null : html;
}
