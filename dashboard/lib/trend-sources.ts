/**
 * The sources the What's trending page pulls skincare news from. Edit this list
 * to change them; `/trending` (.claude/skills/trending) searches each one.
 * Most have no public feed, so `url` is the page to search or read.
 * Dependency-free so plain Node can import it.
 */
export const TREND_SOURCES = [
  { id: "aesthetics-journal", name: "Aesthetics Journal", url: "https://aestheticsjournal.com/news/", home: "https://aestheticsjournal.com/" },
  { id: "professional-beauty", name: "Professional Beauty", url: "https://professionalbeauty.co.uk/news", home: "https://professionalbeauty.co.uk/" },
  { id: "cosmetics-business", name: "Cosmetics Business", url: "https://cosmeticsbusiness.com/news", home: "https://cosmeticsbusiness.com/" },
  { id: "cosmeticsdesign", name: "CosmeticsDesign-Europe", url: "https://www.cosmeticsdesign-europe.com/", home: "https://www.cosmeticsdesign-europe.com/" },
  { id: "beautymatter", name: "BeautyMatter", url: "https://beautymatter.com/", home: "https://beautymatter.com/" },
  { id: "dermatology-times", name: "Dermatology Times", url: "https://www.dermatologytimes.com/", home: "https://www.dermatologytimes.com/" },
  { id: "research", name: "New research (PubMed: acne, rosacea, pigmentation)", url: "https://pubmed.ncbi.nlm.nih.gov/?term=acne+OR+rosacea+OR+hyperpigmentation&sort=date", home: "https://pubmed.ncbi.nlm.nih.gov/" },
  { id: "bad", name: "British Association of Dermatologists", url: "https://www.bad.org.uk/news/", home: "https://www.bad.org.uk/" },
  { id: "regulation", name: "UK rules (ASA, MHRA, gov.uk)", url: "https://www.asa.org.uk/codes-and-rulings/rulings.html", home: "https://www.gov.uk/search/news-and-communications?keywords=cosmetic" },
  { id: "consumer", name: "Consumer beauty press (Vogue UK, Allure, Glamour UK)", url: "https://www.vogue.co.uk/beauty", home: "https://www.allure.com/skin-care" },
  { id: "social", name: "TikTok & Instagram (your screenshots)", url: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en", home: "https://ads.tiktok.com/business/creativecenter/" },
] as const;
