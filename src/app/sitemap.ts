import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

const PATHS = ["/", "/today", "/translate", "/review", "/grammar", "/import", "/exam", "/speak", "/write", "/mistakes", "/path", "/stats", "/diary", "/activity", "/history", "/library", "/settings"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${SITE_URL}${path}` }));
}
