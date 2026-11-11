/**
 * 07:00 Slack digest: the top 5 "hook potential" items from today's pull,
 * newest first (the same list as the top of the What's trending page).
 *
 *   npm run trending:slack            # post to SLACK_WEBHOOK_URL
 *   npm run trending:slack -- --print # print the message instead
 *
 * Slack setup: create an app with an Incoming Webhook for the channel (or DM)
 * you want, and put its URL in SLACK_WEBHOOK_URL (dashboard/.env.local).
 * DASHBOARD_URL (default http://localhost:3000) is linked at the bottom.
 */
import { read } from "../lib/store.ts";
import { topHookItems } from "../lib/hook-potential.ts";

const print = process.argv.includes("--print");
const webhook = process.env.SLACK_WEBHOOK_URL;
if (!webhook && !print) {
  console.error("set SLACK_WEBHOOK_URL (Slack app → Incoming Webhooks), or run with --print");
  process.exit(1);
}

const { meta, sources, items } = await read("trending");
const top = topHookItems(items);
const ageHours = (Date.now() - new Date(meta.updatedAt).getTime()) / 36e5;
const name = (id: string) => sources.find((s) => s.id === id)?.name ?? id;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const warnings = [
  meta.sample ? "⚠️ this is *sample data* — the daily pull hasn't run yet." : "",
  !meta.sample && ageHours > 26 ? `⚠️ the last pull was ${Math.round(ageHours)} hours ago — check the 06:40 job.` : "",
].filter(Boolean);

const blocks = [
  { type: "header", text: { type: "plain_text", text: `🔥 ${top.length} hook-worthy ai stories this morning` } },
  ...warnings.map((w) => ({ type: "context", elements: [{ type: "mrkdwn", text: w }] })),
  ...top.flatMap((item, i) => [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${i + 1}. <${item.url}|${esc(item.title)}>*\n_${esc(name(item.sourceId))}_ · ${esc(item.reason)}\n> 🎬 ${esc(item.hookIdea)}`,
      },
    },
  ]),
  ...(top.length === 0 ? [{ type: "section", text: { type: "mrkdwn", text: "nothing tagged “hook potential” in today's pull." } }] : []),
  { type: "context", elements: [{ type: "mrkdwn", text: `<${process.env.DASHBOARD_URL ?? "http://localhost:3000"}/trending|open what's trending> · ${items.length} items from ${sources.length} sources` }] },
];
const text = `${top.length} hook-worthy ai stories: ${top.map((t) => t.title).join(" · ")}`;

if (print) {
  console.log(JSON.stringify({ text, blocks }, null, 2));
  process.exit(0);
}
const res = await fetch(webhook!, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, blocks }) });
if (!res.ok) {
  console.error(`slack ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log(`sent ${top.length} items to slack`);
