"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BuildFile } from "@/lib/api";
import { highlightCode, languageForPath } from "@/lib/highlight";

// The preview iframe is sandboxed WITHOUT allow-same-origin (so untrusted code
// can't reach this origin/cookies/storage). That gives it a null origin, where
// localStorage/sessionStorage throw on access — and many apps read them on load
// and crash to a blank page. Inject an in-memory shim before the app's scripts
// so storage-using apps render; persistence is just per-view (fine for a preview).
const STORAGE_SHIM =
  "<script>(function(){function m(){var s={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null},setItem:function(k,v){s[k]=String(v)},removeItem:function(k){delete s[k]},clear:function(){s={}},key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}}['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('__p')}catch(e){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(_){}}})})();</script>";

function withStorageShim(html: string): string {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + STORAGE_SHIM);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + STORAGE_SHIM);
  return STORAGE_SHIM + html;
}

// Renders what a run built: a file tree + the selected file's contents, plus a
// live Preview for static HTML (sandboxed iframe — untrusted code can run
// scripts but can't reach this origin, cookies, or storage).
export function BuildOutput({ files }: { files: BuildFile[] }) {
  const html = files.find((f) => f.path.toLowerCase().endsWith(".html"));
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"files" | "preview">(html ? "preview" : "files");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Focus the iframe whenever Preview becomes active or the srcDoc
  // content changes. Without this, keyboard events (arrow keys, space,
  // WASD) keep going to the parent page and games like Snake feel
  // broken — the play button works, but you can't steer.
  useEffect(() => {
    if (tab !== "preview" || !iframeRef.current) return;
    const node = iframeRef.current;
    const focus = () => {
      try {
        node.focus();
        node.contentWindow?.focus();
      } catch {
        // contentWindow access throws cross-origin (sandboxed null
        // origin); the parent .focus() is enough to start the chain.
      }
    };
    focus();
    node.addEventListener("load", focus);
    return () => node.removeEventListener("load", focus);
  }, [tab, html?.content]);

  const onFullscreen = useCallback(() => {
    const node = iframeRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void node.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const onOpenInTab = useCallback(() => {
    if (!html) return;
    const blob = new Blob([withStorageShim(html.content)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // Revoke after the new tab has had time to read the URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [html]);

  // useMemo MUST run on every render — hooks cannot be called after an
  // early return. Fall back to an empty active row when the file list is
  // empty; the empty-files check below the hook still bails out before
  // anything is rendered.
  const active = files.length > 0 ? files[Math.min(sel, files.length - 1)] : null;
  const activeLang = useMemo(
    () => (active ? languageForPath(active.path) : null),
    [active],
  );
  const activeHtml = useMemo(
    () => (active ? highlightCode(active.content, activeLang) : ""),
    [active, activeLang],
  );
  if (!active) return null;

  return (
    <section className="build-output">
      <div className="bo-head">
        <p className="eyebrow">Build output · {files.length} files</p>
        {html && (
          <div className="bo-tabs">
            <button
              type="button"
              className={tab === "preview" ? "on" : ""}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
            <button
              type="button"
              className={tab === "files" ? "on" : ""}
              onClick={() => setTab("files")}
            >
              Files
            </button>
            {tab === "preview" && (
              <>
                <span className="bo-sep" aria-hidden="true" />
                <button
                  type="button"
                  className="bo-action"
                  onClick={onFullscreen}
                  title="Fullscreen"
                >
                  Fullscreen
                </button>
                <button
                  type="button"
                  className="bo-action"
                  onClick={onOpenInTab}
                  title="Open the preview in a new tab"
                >
                  Open in tab ↗
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {tab === "preview" && html ? (
        <iframe
          ref={iframeRef}
          className="bo-preview"
          // Untrusted output: allow scripts (the app needs them) and the
          // ergonomics modern apps assume (modals for game-over dialogs,
          // pointer lock for FPS-style controls, fullscreen request),
          // but NOT same-origin -- so the build can't touch this page,
          // cookies, or storage. allowFullScreen lets the parent's
          // Fullscreen button work; the sandbox token isn't required
          // when the iframe attribute is set, but Safari prefers both.
          sandbox="allow-scripts allow-pointer-lock allow-modals"
          allowFullScreen
          srcDoc={withStorageShim(html.content)}
          title="build preview"
          tabIndex={0}
        />
      ) : (
        <div className="bo-body">
          <ul className="bo-tree">
            {files.map((f, i) => {
              const depth = f.path.split("/").length - 1;
              const name = f.path.split("/").pop() ?? f.path;
              return (
                <li key={f.path}>
                  <button
                    type="button"
                    className={i === sel ? "on" : ""}
                    style={{ paddingLeft: 10 + depth * 12 }}
                    onClick={() => {
                      setSel(i);
                      setTab("files");
                    }}
                    title={f.path}
                  >
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="bo-file">
            <div className="bo-file-head">
              <span className="path">{active.path}</span>
              {activeLang && <span className="lang">{activeLang}</span>}
              {active.truncated && <span className="trunc">truncated</span>}
            </div>
            <pre>
              <code
                className={activeLang ? `hljs language-${activeLang}` : "hljs"}
                dangerouslySetInnerHTML={{ __html: activeHtml }}
              />
            </pre>
          </div>
        </div>
      )}

      <style jsx>{`
        .build-output {
          margin: 24px 0;
          border-radius: 24px;
          background: var(--forest-deep);
          color: #c4edc9;
          overflow: hidden;
        }
        .bo-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(196, 237, 201, 0.14);
        }
        .bo-head .eyebrow {
          margin: 0;
          color: #c4edc9;
        }
        .bo-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .bo-tabs button {
          padding: 6px 16px;
          border: 0;
          border-radius: 999px;
          background: rgba(196, 237, 201, 0.12);
          color: #c4edc9;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .bo-tabs button:hover {
          background: rgba(196, 237, 201, 0.22);
        }
        .bo-tabs button.on {
          color: var(--forest);
          background: var(--lime);
        }
        .bo-sep {
          align-self: stretch;
          width: 1px;
          margin: 4px 4px;
          background: rgba(196, 237, 201, 0.2);
        }
        .bo-tabs button.bo-action {
          color: #c4edc9;
          font-size: 12px;
        }
        .bo-preview {
          display: block;
          width: 100%;
          height: 460px;
          border: 0;
          background: var(--panel);
          backdrop-filter: blur(22px) saturate(160%);
        }
        .bo-preview:fullscreen {
          width: 100vw;
          height: 100vh;
        }
        .bo-body {
          display: grid;
          grid-template-columns: minmax(140px, 220px) minmax(0, 1fr);
          min-height: 260px;
          max-height: 460px;
        }
        .bo-tree {
          margin: 0;
          padding: 8px 0;
          list-style: none;
          border-right: 1px solid rgba(196, 237, 201, 0.14);
          overflow: auto;
        }
        .bo-tree button {
          display: block;
          width: 100%;
          padding: 5px 12px;
          border: 0;
          background: transparent;
          color: #8fc596;
          font-family: var(--font-mono);
          font-size: 12px;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
        }
        .bo-tree button:hover {
          color: #ffffff;
        }
        .bo-tree button.on {
          color: var(--lime);
          background: rgba(196, 237, 201, 0.1);
        }
        .bo-file {
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }
        .bo-file-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 16px;
          border-bottom: 1px solid rgba(196, 237, 201, 0.14);
          color: #8fc596;
          font-family: var(--font-mono);
          font-size: 12px;
        }
        .bo-file-head .trunc {
          color: var(--lime);
        }
        .bo-file pre {
          margin: 0;
          padding: 14px 16px;
          overflow: auto;
        }
        .bo-file code {
          color: #c4edc9;
          font-family: var(--font-mono);
          font-size: 12.5px;
          line-height: 1.55;
          white-space: pre;
        }
        .bo-file-head .lang {
          color: #8fc596;
          font-family: var(--font-mono);
          font-size: 11px;
        }
      `}</style>
      <style jsx global>{`
        .bo-file .hljs-comment,
        .bo-file .hljs-quote {
          color: #6fa176;
          font-style: italic;
        }
        .bo-file .hljs-keyword,
        .bo-file .hljs-selector-tag,
        .bo-file .hljs-meta-keyword,
        .bo-file .hljs-doctag {
          color: #f0fe9b;
          font-weight: 600;
        }
        .bo-file .hljs-string,
        .bo-file .hljs-attr,
        .bo-file .hljs-symbol,
        .bo-file .hljs-bullet,
        .bo-file .hljs-addition {
          color: #8be29a;
        }
        .bo-file .hljs-number,
        .bo-file .hljs-literal,
        .bo-file .hljs-meta {
          color: #ffd98a;
        }
        .bo-file .hljs-title,
        .bo-file .hljs-section,
        .bo-file .hljs-name,
        .bo-file .hljs-built_in,
        .bo-file .hljs-class .hljs-title {
          color: #ffffff;
        }
        .bo-file .hljs-variable,
        .bo-file .hljs-template-variable,
        .bo-file .hljs-type,
        .bo-file .hljs-params {
          color: #c4edc9;
        }
        .bo-file .hljs-tag,
        .bo-file .hljs-deletion {
          color: #9fd4a6;
        }
        .bo-file .hljs-emphasis {
          font-style: italic;
        }
        .bo-file .hljs-strong {
          font-weight: 600;
        }
        @media (max-width: 720px) {
          .bo-body {
            grid-template-columns: 1fr;
            max-height: none;
          }
          .bo-tree {
            border-right: 0;
            border-bottom: 1px solid rgba(196, 237, 201, 0.14);
            max-height: 140px;
          }
        }
      `}</style>
    </section>
  );
}
