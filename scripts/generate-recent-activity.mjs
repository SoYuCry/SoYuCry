import { writeFile } from "node:fs/promises";

const user = process.env.GITHUB_USER || "SoYuCry";
const token = process.env.GITHUB_TOKEN;
const response = await fetch(`https://api.github.com/users/${user}/events?per_page=100`, {
  headers: {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "profile-recent-activity",
    "X-GitHub-Api-Version": "2022-11-28",
  },
});
if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const shorten = (value, length = 86) => value.length > length
  ? `${value.slice(0, length - 1)}…` : value;

function describe(event) {
  const repo = event.repo.name;
  const payload = event.payload || {};
  switch (event.type) {
    case "PullRequestEvent":
      return `${payload.action} PR #${payload.number} in ${repo}: ${payload.pull_request?.title || "Pull request"}`;
    case "PullRequestReviewEvent":
      return `reviewed PR #${payload.pull_request?.number} in ${repo}: ${payload.pull_request?.title || "Pull request"}`;
    case "IssuesEvent":
      return `${payload.action} issue #${payload.issue?.number} in ${repo}: ${payload.issue?.title || "Issue"}`;
    case "IssueCommentEvent":
      return `commented on #${payload.issue?.number} in ${repo}: ${payload.issue?.title || "Issue"}`;
    case "ReleaseEvent":
      return `released ${payload.release?.tag_name || "a new version"} in ${repo}`;
    case "ForkEvent":
      return `forked ${repo}`;
    case "WatchEvent":
      return `starred ${repo}`;
    case "CreateEvent":
      return `created ${payload.ref_type}${payload.ref ? ` ${payload.ref}` : ""} in ${repo}`;
    case "PushEvent":
      return `pushed ${payload.size || ""} commit${payload.size === 1 ? "" : "s"} to ${repo}`.replace("pushed  commits", "pushed commits");
    default:
      return null;
  }
}

const activities = (await response.json())
  .filter((event) => !(event.repo.name === `${user}/${user}` && event.type === "PushEvent"))
  .map((event) => ({ text: describe(event), date: event.created_at.slice(0, 10) }))
  .filter(({ text }) => text)
  .slice(0, 5);

const rows = activities.map(({ text, date }, index) => {
  const y = 64 + index * 34;
  return `<circle cx="29" cy="${y - 5}" r="4" class="dot"/><text x="44" y="${y}" class="activity">${escapeXml(shorten(text))}</text><text x="755" y="${y}" text-anchor="end" class="date">${date}</text>`;
}).join("\n  ");
const height = 42 + Math.max(activities.length, 1) * 34;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 780 ${height}" role="img" aria-label="Recent GitHub activity">
  <style>
    .bg{fill:#0d1117;stroke:#30363d}.title{fill:#f0f6fc;font:600 16px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.activity{fill:#c9d1d9;font:13px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.date{fill:#8b949e;font:11px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.dot{fill:#58a6ff}
  </style>
  <rect class="bg" x="0.5" y="0.5" width="779" height="${height - 1}" rx="8"/>
  <text x="24" y="30" class="title">Recent activity</text>
  ${rows || '<text x="24" y="64" class="date">No recent public activity</text>'}
</svg>\n`;
await writeFile("recent-activity.svg", svg);
