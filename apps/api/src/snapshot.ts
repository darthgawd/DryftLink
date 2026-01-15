import { load } from "cheerio";
import type { ChangeLevel } from "@prisma/client";
import { prisma } from "./db.js";

/**
 * Represents the extracted "fingerprint" of a page
 * (what's on it, but not the full HTML)
 */
export interface PageFingerprint {
  scripts: string[]; // URLs of <script src="...">
  styles: string[]; // URLs of <link rel="stylesheet">
  images: string[]; // URLs of <img src="...">
  metaTags: Record<string, string>; // All <meta> tags as key=value
}

/**
 * Extract fingerprint from HTML
 * Parses the HTML and extracts structured data about scripts, styles, images, meta tags
 */
export function extractFingerprint(html: string): PageFingerprint {
  const $ = load(html);

  // Extract script URLs
  const scripts: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scripts.push(src);
  });

  // Extract stylesheet URLs
  const styles: string[] = [];
  $("link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr("href");
    if (href) styles.push(href);
  });

  // Extract image URLs
  const images: string[] = [];
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) images.push(src);
  });

  // Extract meta tags
  const metaTags: Record<string, string> = {};
  $("meta").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("property") || "";
    const content = $(el).attr("content") || "";
    if (name && content) {
      metaTags[name] = content;
    }
  });

  return { scripts, styles, images, metaTags };
}

/**
 * Diff result between two fingerprints
 */
export interface DiffResult {
  scriptsAdded: string[];
  scriptsRemoved: string[];
  stylesAdded: string[];
  stylesRemoved: string[];
  imagesAdded: string[];
  imagesRemoved: string[];
  metaTagsChanged: boolean;
  htmlSizeDiff: number; // bytes difference
  changeLevel: ChangeLevel;
}

/**
 * Compute diff between current and previous fingerprint
 */
export function computeDiff(
  current: PageFingerprint,
  currentHtmlSize: number,
  previous: { fingerprint: PageFingerprint; htmlSize: number } | null
): DiffResult {
  if (!previous) {
    // First snapshot, no previous to compare
    return {
      scriptsAdded: [],
      scriptsRemoved: [],
      stylesAdded: [],
      stylesRemoved: [],
      imagesAdded: [],
      imagesRemoved: [],
      metaTagsChanged: false,
      htmlSizeDiff: 0,
      changeLevel: "NONE",
    };
  }

  const prev = previous.fingerprint;

  // Set math for arrays
  const scriptsAdded = current.scripts.filter((s) => !prev.scripts.includes(s));
  const scriptsRemoved = prev.scripts.filter((s) => !current.scripts.includes(s));
  const stylesAdded = current.styles.filter((s) => !prev.styles.includes(s));
  const stylesRemoved = prev.styles.filter((s) => !current.styles.includes(s));
  const imagesAdded = current.images.filter((s) => !prev.images.includes(s));
  const imagesRemoved = prev.images.filter((s) => !current.images.includes(s));

  // Check if meta tags changed
  const metaTagsChanged = JSON.stringify(current.metaTags) !== JSON.stringify(prev.metaTags);

  // Size diff
  const htmlSizeDiff = currentHtmlSize - previous.htmlSize;
  const sizeChangePercent = (htmlSizeDiff / previous.htmlSize) * 100;

  // Determine change level
  let changeLevel: ChangeLevel = "NONE";
  if (
    scriptsAdded.length > 0 ||
    scriptsRemoved.length > 0 ||
    stylesAdded.length > 0 ||
    stylesRemoved.length > 0 ||
    imagesAdded.length > 0 ||
    imagesRemoved.length > 0 ||
    metaTagsChanged
  ) {
    // Something changed

    // MAJOR: > 50% size change, OR many scripts added
    if (Math.abs(sizeChangePercent) > 50 || scriptsAdded.length > 3) {
      changeLevel = "MAJOR";
    }
    // MODERATE: 10-50% size change, OR 1-3 scripts added
    else if (Math.abs(sizeChangePercent) > 10 || scriptsAdded.length > 0) {
      changeLevel = "MODERATE";
    }
    // MINOR: small changes
    else {
      changeLevel = "MINOR";
    }
  }

  return {
    scriptsAdded,
    scriptsRemoved,
    stylesAdded,
    stylesRemoved,
    imagesAdded,
    imagesRemoved,
    metaTagsChanged,
    htmlSizeDiff,
    changeLevel,
  };
}

/**
 * Create a snapshot for a site check
 * Captures HTML, extracts fingerprint, computes diff vs previous, stores in DB
 */
export async function createSnapshot(
  siteId: string,
  htmlBody: string,
  statusCode: number,
  headers: Record<string, string | string[] | undefined>
): Promise<void> {
  const htmlSize = Buffer.byteLength(htmlBody, "utf8");

  // Extract fingerprint from current HTML
  const currentFingerprint = extractFingerprint(htmlBody);

  // Get previous snapshot for this site
  const previousSnapshot = await prisma.siteSnapshot.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  // Compute diff
  let diffResult: DiffResult;
  if (previousSnapshot) {
    // Extract previous fingerprint by re-parsing its HTML
    const previousFingerprint = extractFingerprint(previousSnapshot.htmlBody);
    diffResult = computeDiff(currentFingerprint, htmlSize, {
      fingerprint: previousFingerprint,
      htmlSize: previousSnapshot.htmlSize,
    });
  } else {
    diffResult = computeDiff(currentFingerprint, htmlSize, null);
  }

  // Normalize headers to simple key-value (remove arrays)
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalizedHeaders[key] = value.join(", ");
    } else if (value) {
      normalizedHeaders[key] = value;
    }
  }

  // Create snapshot
  await prisma.siteSnapshot.create({
    data: {
      siteId,
      htmlBody,
      htmlSize,
      statusCode,
      headers: normalizedHeaders,
      previousSnapshotId: previousSnapshot?.id || null,
      diffSummary: {
        scriptsAdded: diffResult.scriptsAdded,
        scriptsRemoved: diffResult.scriptsRemoved,
        stylesAdded: diffResult.stylesAdded,
        stylesRemoved: diffResult.stylesRemoved,
        imagesAdded: diffResult.imagesAdded,
        imagesRemoved: diffResult.imagesRemoved,
        metaTagsChanged: diffResult.metaTagsChanged,
        htmlSizeDiff: diffResult.htmlSizeDiff,
      },
      changeLevel: diffResult.changeLevel,
    },
  });
}
