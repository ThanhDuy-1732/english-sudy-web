/** @jest-environment node */
import { countSharedRequest } from "../shared-rate-limit";

const mockSql = jest.fn();
jest.mock("@neondatabase/serverless", () => ({ neon: () => mockSql }));

const original = process.env.DATABASE_URL;
beforeEach(() => { process.env.DATABASE_URL = "postgres://test"; });
afterAll(() => { if (original === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = original; });

test("allows requests up to the cap and returns the wait above it", async () => {
  mockSql.mockResolvedValueOnce([{ fails: 60, since: new Date().toISOString() }]);
  expect(await countSharedRequest("1.2.3.4")).toBe(0);
  mockSql.mockResolvedValueOnce([{ fails: 61, since: new Date().toISOString() }]);
  const wait = await countSharedRequest("1.2.3.4");
  expect(wait).toBeGreaterThan(0);
  expect(wait).toBeLessThanOrEqual(60);
});

test("fails open without a database or when it errors", async () => {
  mockSql.mockRejectedValueOnce(new Error("down"));
  jest.spyOn(console, "error").mockImplementation(() => {});
  expect(await countSharedRequest("1.2.3.4")).toBe(0);
  delete process.env.DATABASE_URL;
  expect(await countSharedRequest("1.2.3.4")).toBe(0);
});
