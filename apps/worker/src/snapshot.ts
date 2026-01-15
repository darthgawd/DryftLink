// Re-export from apps/api/src/snapshot.ts
// This is a lightweight wrapper since the worker needs access to the same snapshot logic

import { load } from "cheerio";
import type { ChangeLevel } from "@prisma/client";
import { prisma } from "./db.js";

/**
 * Represents the extracted "fingerprint" of a page
 */
export interface PageFingerprint {
  scripts: string[];
  styles: string[];
  images: string[];
  metaTags: Record<string, string>;
}

/**
 * Extract fingerprint from HTML
 */
export function extractFingerprint(html: string): PageFingerprint {
  const $ = load(html);

  const scripts: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scripts.push(src);
  });

  const styles: string[] = [];
  $("link[rel='stylesheet']").each((_, el) => {
    const href = $(el).attr("href");
    if (href) styles.push(href);
  });

  const images: string[] = [];
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) images.push(src);
  });

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
  htmlSizeDiff: number;
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

  const scriptsAdded = current.scripts.filter((s) => !prev.scripts.includes(s));
  const scriptsRemoved = prev.scripts.filter((s) => !current.scripts.includes(s));
  const stylesAdded = current.styles.filter((s) => !prev.styles.includes(s));
  const stylesRemoved = prev.styles.filter((s) => !current.styles.includes(s));
  const imagesAdded = current.images.filter((s) => !prev.images.includes(s));
  const imagesRemoved = prev.images.filter((s) => !current.images.includes(s));

  const metaTagsChanged = JSON.stringify(current.metaTags) !== JSON.stringify(prev.metaTags);

  const htmlSizeDiff = currentHtmlSize - previous.htmlSize;
  const sizeChangePercent = (htmlSizeDiff / previous.htmlSize) * 100;

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
    if (Math.abs(sizeChangePercent) > 50 || scriptsAdded.length > 3) {
      changeLevel = "MAJOR";
    } else if (Math.abs(sizeChangePercent) > 10 || scriptsAdded.length > 0) {
      changeLevel = "MODERATE";
    } else {
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
 */
export async function createSnapshot(
  siteId: string,
  htmlBody: string,
  statusCode: number,
  headers: Record<string, string | string[] | undefined>
): Promise<void> {
  const htmlSize = Buffer.byteLength(htmlBody, "utf8");

  const currentFingerprint = extractFingerprint(htmlBody);

  const previousSnapshot = await prisma.siteSnapshot.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  let diffResult: DiffResult;
  if (previousSnapshot) {
    const previousFingerprint = extractFingerprint(previousSnapshot.htmlBody);
    diffResult = computeDiff(currentFingerprint, htmlSize, {
      fingerprint: previousFingerprint,
      htmlSize: previousSnapshot.htmlSize,
    });
  } else {
    diffResult = computeDiff(currentFingerprint, htmlSize, null);
  }

  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalizedHeaders[key] = value.join(", ");
    } else if (value) {
      normalizedHeaders[key] = value;
    }
  }

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
