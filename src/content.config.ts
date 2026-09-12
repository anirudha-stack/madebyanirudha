import { defineCollection, type SchemaContext } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// "Add a post = add a file." Each collection is a folder of MDX files whose
// frontmatter is validated here at build time, so a typo fails the build
// rather than shipping a broken page.

const post = ({ image }: SchemaContext) =>
  z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    cover: image().optional(),
    draft: z.boolean().default(false),
  });

// How-to guides: step-by-step, reproducible.
const guides = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/guides" }),
  schema: post,
});

// Build logs: the day-in-my-life blog — what was made, how it went, what broke.
const logs = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/logs" }),
  schema: post,
});

// Projects: finished things. Every project states all four layers, because
// "one person, whole device" is the claim the site exists to prove.
const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      date: z.coerce.date(),
      flagship: z.boolean().default(false),
      cover: image(),
      coverAlt: z.string(),
      layers: z.object({
        pcb: z.string(),
        enclosure: z.string(),
        firmware: z.string(),
        software: z.string(),
      }),
      gallery: z.array(z.object({ src: image(), alt: z.string() })).default([]),
      links: z
        .object({
          repo: z.url().optional(),
          files: z.url().optional(),
        })
        .default({}),
      // Stand-in content authored before the real material existed. Rendered
      // with a visible label so a visitor never mistakes it for the real thing.
      synthetic: z.boolean().default(false),
      draft: z.boolean().default(false),
    }),
});

export const collections = { guides, logs, projects };
