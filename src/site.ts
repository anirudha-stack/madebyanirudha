// Site-wide facts. Content lives in src/content; this is identity only.
export const site = {
  name: "Anirudha",
  wordmark: "made by Anirudha",
  domain: "https://madebyanirudha.in",
  email: "madebyanirudha@gmail.com",
  identity: "Software that thinks. Hardware that moves.",
  description:
    "Anirudha designs the circuit board, the enclosure, the firmware and the software — the whole device. Build logs, how-to guides, and the things he makes.",
  // Analytics. GoatCounter (goatcounter.com): no cookies, no cross-site
  // tracking, IP never stored. `code` is the GoatCounter site's subdomain —
  // https://<code>.goatcounter.com. Set to "" to disable analytics entirely
  // (the script is dropped and the footer count simply never appears).
  analytics: {
    goatcounter: "madebyanirudha",
  },
  // Elsewhere on the web. Rendered in the footer in this order.
  links: [
    {
      label: "Instructables",
      href: "https://www.instructables.com/member/madebyanirudha",
    },
    { label: "Instagram", href: "https://www.instagram.com/madebyanirudha/" },
    { label: "YouTube", href: "https://www.youtube.com/@madebyanirudha" },
  ],
};
