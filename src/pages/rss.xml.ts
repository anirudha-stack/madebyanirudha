import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { site } from "../site";

// One feed for everything written: build logs and how-to guides, newest first.
export async function GET(context: APIContext) {
  const logs = await getCollection("logs", ({ data }) => !data.draft);
  const guides = await getCollection("guides", ({ data }) => !data.draft);
  const items = [
    ...logs.map((e) => ({ ...e, base: "/logs" })),
    ...guides.map((e) => ({ ...e, base: "/guides" })),
  ].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: site.wordmark,
    description: site.description,
    site: context.site ?? site.domain,
    items: items.map((e) => ({
      title: e.data.title,
      description: e.data.description,
      pubDate: e.data.date,
      link: `${e.base}/${e.id}`,
      categories: [e.base === "/logs" ? "Build log" : "Guide"],
    })),
    customData: "<language>en</language>",
  });
}
