/**
 * The 12 sources the What's trending page pulls from. Edit this list to change
 * them; `scripts/fetch-trending.ts` reads it. All are public RSS/Atom feeds.
 * Dependency-free so plain Node can import it.
 */
export const TREND_SOURCES = [
  { id: "openai", name: "OpenAI News", url: "https://openai.com/news/rss.xml", home: "https://openai.com/news/" },
  { id: "deepmind", name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", home: "https://deepmind.google/discover/blog/" },
  { id: "google-ai", name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", home: "https://blog.google/technology/ai/" },
  { id: "huggingface", name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", home: "https://huggingface.co/blog" },
  { id: "verge", name: "The Verge — AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", home: "https://www.theverge.com/ai-artificial-intelligence" },
  { id: "techcrunch", name: "TechCrunch — AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", home: "https://techcrunch.com/category/artificial-intelligence/" },
  { id: "mit-tr", name: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", home: "https://www.technologyreview.com/topic/artificial-intelligence/" },
  { id: "venturebeat", name: "VentureBeat — AI", url: "https://venturebeat.com/category/ai/feed/", home: "https://venturebeat.com/category/ai/" },
  { id: "ars", name: "Ars Technica — AI", url: "https://arstechnica.com/ai/feed/", home: "https://arstechnica.com/ai/" },
  { id: "wired", name: "WIRED — AI", url: "https://www.wired.com/feed/tag/ai/latest/rss", home: "https://www.wired.com/tag/artificial-intelligence/" },
  { id: "hn", name: "Hacker News (AI, 100+ pts)", url: "https://hnrss.org/newest?q=AI&points=100", home: "https://news.ycombinator.com/" },
  { id: "reddit-ai", name: "r/artificial (top, week)", url: "https://www.reddit.com/r/artificial/top/.rss?t=week", home: "https://www.reddit.com/r/artificial/" },
] as const;
