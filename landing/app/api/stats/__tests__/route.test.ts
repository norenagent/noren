import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("GET /api/stats", () => {
  it("returns static facts about the shipped code, with no upstream data", async () => {
    const res = GET();
    const body = await res.json();
    expect(body).toEqual({ crates: "50", tests: "3870", live: "486", primitives: "8" });
    expect(body.commits).toBeUndefined();
    expect(body.head).toBeUndefined();
  });
});
