import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// "Add a post = add a file." Each collection is a folder of MDX files whose
// frontmatter is validated here at build time, so a typo fails the build
// rather than shipping a broken page.

// How-to guides: step-by-step, reproducible.
const guides = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/guides" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      cover: image().optional(),
      draft: z.boolean().default(false),
    }),
});

// Build logs: the day-in-my-life blog — what was made, how it went, what broke.
const logs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/logs" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      cover: image().optional(),
      draft: z.boolean().default(false),
    }),
});

export const collections = { guides, logs };
