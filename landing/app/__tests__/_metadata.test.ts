import { describe, expect, it } from "vitest";
import { cardAlt, cardImageUrl, pageMetadata } from "../_metadata";

describe("cardImageUrl", () => {
  it("points every page but home at its generated card", () => {
    expect(cardImageUrl("/brand/color")).toBe("https://usenoren.xyz/og/brand/color.png");
    expect(cardImageUrl("/docs")).toBe("https://usenoren.xyz/og/docs.png");
    expect(cardImageUrl("/")).toBe("https://usenoren.xyz/opengraph-image.jpg");
  });
});

describe("cardAlt", () => {
  it("names Noren, the section and the headline", () => {
    expect(cardAlt("Color", "Brand guidelines")).toBe("Noren brand guidelines: Color");
    expect(cardAlt("Positions", "Noren Stake")).toBe("Noren Stake: Positions");
    expect(cardAlt("The Noren token")).toBe("The Noren token");
    expect(cardAlt("About Noren")).toBe("About Noren");
    expect(cardAlt(undefined)).toBe("Noren");
  });
});

describe("pageMetadata", () => {
  it("fills in the canonical address, social tags and the card", () => {
    const m = pageMetadata("/sdk", { title: "Noren SDK" }, { title: "SDK", description: "The TypeScript SDK." });
    const image = "https://usenoren.xyz/og/sdk.png";

    expect(m.alternates?.canonical).toBe("https://usenoren.xyz/sdk");
    expect(m.openGraph).toMatchObject({ url: "https://usenoren.xyz/sdk", title: "SDK", description: "The TypeScript SDK." });
    expect(m.openGraph?.images).toEqual([{ url: image, width: 1200, height: 630, alt: "Noren SDK" }]);
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: "SDK" });
    expect((m.twitter as { images: Array<{ url: string }> }).images[0].url).toBe(image);
    expect(m.other).toEqual({ "noren:card-title": "Noren SDK" });
  });

  it("keeps what the page declares and replaces only the images", () => {
    const m = pageMetadata("/notes/sample", { section: "Blog" }, {
      title: "A sample note",
      alternates: { canonical: "/notes/sample" },
      openGraph: { type: "article", title: "Social title", description: "Social description", images: "/old.jpg" },
      twitter: { description: "Short description.", images: "/old.jpg" },
    });

    expect(m.alternates?.canonical).toBe("/notes/sample");
    expect(m.openGraph).toMatchObject({ type: "article", title: "Social title", description: "Social description" });
    expect(m.openGraph?.images).toEqual([
      { url: "https://usenoren.xyz/og/notes/sample.png", width: 1200, height: 630, alt: "Noren blog: A sample note" },
    ]);
    expect(m.twitter).toMatchObject({ title: "Social title", description: "Short description." });
    expect(m.other).toEqual({
      "noren:card-title": "A sample note",
      "noren:card-section": "Blog",
    });
  });
});
