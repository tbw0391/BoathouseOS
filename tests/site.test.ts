import { describe, expect, it } from "vitest";
import { clubSlugFromHost } from "@/lib/site";

describe("clubSlugFromHost", () => {
  it("reads the club from its boathouseos.app address", () => {
    expect(clubSlugFromHost("westerville.boathouseos.app")).toBe("westerville");
    expect(clubSlugFromHost("Westerville.BoathouseOS.app:443")).toBe("westerville");
  });

  it("ignores the demo's own addresses and anything else", () => {
    expect(clubSlugFromHost("boathouseos.app")).toBeNull();
    expect(clubSlugFromHost("www.boathouseos.app")).toBeNull();
    expect(clubSlugFromHost("localhost:3000")).toBeNull();
    expect(clubSlugFromHost("evil.boathouseos.app.example.com")).toBeNull();
    expect(clubSlugFromHost("a.b.boathouseos.app")).toBeNull();
    expect(clubSlugFromHost(null)).toBeNull();
  });
});
