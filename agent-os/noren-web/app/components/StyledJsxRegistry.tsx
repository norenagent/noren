"use client";

import React, { useState } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { StyleRegistry, createStyleRegistry } from "styled-jsx";

// styled-jsx collects component CSS at render time. In the App Router that CSS is only
// written into the page if the registry is flushed during server rendering. Without this,
// the first HTML arrives with class names but no rules (an unstyled page) and the styles
// are injected only after hydration.
export default function StyledJsxRegistry({ children }: { children: React.ReactNode }) {
  const [registry] = useState(() => createStyleRegistry());
  useServerInsertedHTML(() => {
    const styles = registry.styles();
    registry.flush();
    return <>{styles}</>;
  });
  return <StyleRegistry registry={registry}>{children}</StyleRegistry>;
}
