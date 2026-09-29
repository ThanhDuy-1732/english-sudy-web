import { recordTagResult, getTagAccuracies, getWeakTags, selectAdaptiveItems } from "../exam-tags";

const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  Object.defineProperty(global, "localStorage", {
    value: {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
    },
    writable: true,
    configurable: true,
  });
});

describe("recordTagResult / getTagAccuracies", () => {
  it("starts empty", () => {
    expect(getTagAccuracies()).toEqual([]);
  });

  it("records correct and incorrect", () => {
    recordTagResult("verb-tense", true);
    recordTagResult("verb-tense", false);
    recordTagResult("verb-tense", true);
    const acc = getTagAccuracies();
    expect(acc).toHaveLength(1);
    expect(acc[0].tag).toBe("verb-tense");
    expect(acc[0].correct).toBe(2);
    expect(acc[0].total).toBe(3);
    expect(acc[0].accuracy).toBe(67);
  });

  it("tracks multiple tags independently", () => {
    recordTagResult("articles", true);
    recordTagResult("prepositions", false);
    const accs = getTagAccuracies();
    expect(accs).toHaveLength(2);
  });
});

describe("getWeakTags", () => {
  it("returns only tags with >= 3 attempts below threshold", () => {
    // Only 2 attempts — should not appear
    recordTagResult("articles", false);
    recordTagResult("articles", false);
    // 3 attempts, 0% accuracy — weak
    recordTagResult("verb-tense", false);
    recordTagResult("verb-tense", false);
    recordTagResult("verb-tense", false);
    // 3 attempts, 100% accuracy — strong
    recordTagResult("prepositions", true);
    recordTagResult("prepositions", true);
    recordTagResult("prepositions", true);

    const weak = getWeakTags(60);
    expect(weak.map((t) => t.tag)).toContain("verb-tense");
    expect(weak.map((t) => t.tag)).not.toContain("articles");
    expect(weak.map((t) => t.tag)).not.toContain("prepositions");
  });
});

describe("selectAdaptiveItems", () => {
  it("returns all items when count >= items.length", () => {
    const items = [{ tags: ["a"] }, { tags: ["b"] }];
    expect(selectAdaptiveItems(items, 5)).toHaveLength(2);
  });

  it("returns exactly count items", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, tags: ["t"] }));
    expect(selectAdaptiveItems(items, 3)).toHaveLength(3);
  });

  it("prioritises weak-tag items", () => {
    // Make "weak-tag" a known weak tag
    for (let i = 0; i < 5; i++) recordTagResult("weak-tag", false);

    const weakItems = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, tags: ["weak-tag"] }));
    const strongItems = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, tags: [] }));
    const all = [...weakItems, ...strongItems];
    const selected = selectAdaptiveItems(all, 4);

    const weakSelected = selected.filter((item) => item.id?.toString().startsWith("w")).length;
    // With 70% weight on weak, at least 2 of 4 should be weak
    expect(weakSelected).toBeGreaterThanOrEqual(2);
  });
});
