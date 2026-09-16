---
name: build-log-from-dump
description: Convert a build-log dump (build-log-dump-YYYY-MM-DD.md, produced by the global /build-log-dump skill in a project repo) into a build-log entry at src/content/logs/<slug>.mdx, copying its photos into src/assets, then verifying it builds and showing it on localhost. Triggers on "convert this dump", "build log from dump", "turn the dump into a build log", "/build-log-from-dump <path>".
---

# Build log from dump

Input: the path to a `build-log-dump-*.md` (given as an argument or in the message). If no
path was given, ask for it — do not go looking through other drives. Output: one new MDX
file in `src/content/logs/`, any photos it needs in `src/assets/`, verified with a build and
served on localhost for review. Never commit or push; the user reviews first, then says so.

## Steps

1. **Read the dump fully.** The narrative sections (project, what happened, code now vs
   before, what broke, numbers, photos, open questions, user's verbatim answers) are the
   material. The appendix is for checking a claim, not for quoting. The "For the writer"
   block gives a suggested slug/title/description/date/cover — treat as suggestions.

2. **Resolve the gaps before writing.** Collect every `[GAP]` and every "not provided". If
   any would leave a hole in the story (no photos at all, no idea what broke, no date), ask
   the user once, in one message, with all the questions together. Anything still unanswered
   is left out of the post — never filled in from imagination. A post with fewer facts is
   fine; a post with a wrong one is not.

3. **Photos.** For each image the dump lists (repo paths or user-supplied paths):
   - Copy into `src/assets/<ProjectName>/` — the folder name matches the project's existing
     one if there is one (`WristWatch` for the e-paper watch), else a new PascalCase folder.
   - Rename to descriptive kebab-case: `watch-bench.jpg`, not `DSC01505.JPG`. Keep the
     original extension, lowercase it.
   - Skip anything over ~6 MB or ask whether to downscale it first; the site serves
     responsive widths but the source still ships in the repo.
   - Choose one as `cover` only if it shows the thing the post is about. No cover is fine.
   - Look at each image you place (Read the file) so the alt text describes what is actually
     in it, in the style of the existing `coverAlt`/gallery alts in `src/content/projects/`.

4. **Write `src/content/logs/<slug>.mdx`.**
   - Slug: `<project>-<what-this-stretch-was-about>`, short, kebab-case, e.g.
     `chronos-refresh-ghosting`. Check it does not already exist.
   - Frontmatter, exactly the `logs` schema in `src/content.config.ts`:
     ```yaml
     ---
     title: "<specific, ≤60 chars, says what happened, not 'Update #3'>"
     description: "<one sentence, ≤160 chars, the hook — shows in the list under the title>"
     date: YYYY-MM-DD   # date of the last commit in the dump's range, not today
     cover: ../../assets/<ProjectName>/<file>   # omit the line if no cover
     draft: false
     ---
     ```
   - Body: 400–900 words of prose. Open with the situation (one or two sentences, no
     "In this post I will"). Then the story in the order it happened: what was made, how it
     went, what broke and what the fix or dead end was, what is next. Use `##` headings only
     if the post has distinct chapters; a single stretch of work usually reads better as
     continuous prose with one or two headings at most.
   - Inline images as markdown with relative paths so Astro optimises them:
     `![<alt describing the photo>](../../assets/<ProjectName>/<file>)`
     Place each next to the paragraph it illustrates, not in a pile at the end.
   - Numbers go in the prose with their unit, exactly as the dump has them. Code goes in
     fenced blocks only when the code itself is the point (a wrong constant, a fix); never
     paste code for decoration.
   - Link the project page (`/projects/<id>`) once, where it is natural, if one exists.

5. **Voice.** First person, present-tense where it is still true. Witty in the sense of a
   sharp observation, not a joke per paragraph; the humour is in the honesty ("the display
   drew the time perfectly, twice, on top of itself"). Mechanically accurate: name the
   peripheral, the pin, the constant, the tolerance. Short sentences carry the facts. No
   "excited to share", no "journey", no "dive in", no exclamation marks. What was open at
   dump time stays open in the post.

6. **Verify.**
   - `npm run check` — schema and lint.
   - `npm run build` — confirms the cover/inline image paths resolve and MDX compiles. Fix
     anything it reports.
   - Dev server (Astro 7 daemonises it): `npx astro dev status`; if not running,
     `npx astro dev --host 127.0.0.1 --port 4321 &`. Content collections pick up the new
     file without a restart. Give the user `http://127.0.0.1:4321/logs/<slug>` and
     `http://127.0.0.1:4321/logs` for the list.
   - Screenshot the post page (playwright-core in the scratchpad driving installed Chrome,
     `channel: "chrome"`, full page after scrolling to the bottom so lazy images load) and
     Read the PNG, so you have seen the images render and the length looks right before
     handing over.

7. **Hand over.** Tell the user: the file path, the photos you added and their new names,
   any `[GAP]`s you left out and why, and the localhost URL. Wait for review. Commit only
   when they say so; the commit message names the post, e.g.
   `Add build log: <title>`.

## Do not

- Do not edit `src/content.config.ts`, layouts, or components to fit the post. If the post
  needs a feature the site lacks (video, a gallery grid), write the post without it and say
  what is missing.
- Do not touch the project page in `src/content/projects/` unless the user asks — the log
  is the diary, the project page is the finished thing.
- Do not paraphrase the user's verbatim answers into claims they did not make.
- Do not delete the dump file; it stays wherever the user keeps it.
