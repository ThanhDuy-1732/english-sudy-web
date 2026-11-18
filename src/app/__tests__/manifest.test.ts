import manifest from "../manifest";

test("provides an installable standalone manifest", () => {
  const value = manifest();

  expect(value).toMatchObject({
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#0e1f19",
    background_color: "#0e1f19",
  });
  expect(value.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]),
  );
});
