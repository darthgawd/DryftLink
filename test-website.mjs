#!/usr/bin/env node
/* global console */
import express from "express";

const app = express();
const PORT = 3333;

/**
 * Generates random content
 * Alternates between "small" state (minimal HTML) and "large" state (bloated HTML with extra scripts/images)
 */
function generateContent(isLarge) {
  const timestamp = new Date().toISOString();

  if (isLarge) {
    // LARGE STATE: ~15KB with lots of scripts, images, meta tags, and padding
    const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`;
    
    // Generate scripts
    const scripts = Array.from({ length: 10 })
      .map((_, i) => `<script src="https://cdn.example.com/lib${i}.js"></script>`)
      .join("\n");

    // Generate images
    const images = Array.from({ length: 20 })
      .map((_, i) => `<img src="https://images.example.com/pic${i}.jpg" alt="Image ${i}">`)
      .join("\n");

    // Generate meta tags
    const metaTags = Array.from({ length: 10 })
      .map((_, i) => `<meta name="data-${i}" content="Large state metadata tag number ${i}">`)
      .join("\n");

    // Generate padding content
    const paddingCards = Array.from({ length: 25 })
      .map((_, i) => `
      <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0;">
        <h3>Article ${i + 1}</h3>
        <p>${loremIpsum}</p>
        <p>Data point: ${loremIpsum}</p>
        <p>Additional info: ${loremIpsum}</p>
      </div>`)
      .join("\n");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DryftLink Test Site - LARGE STATE</title>
        <meta charset="UTF-8">
        <meta name="description" content="Test site for snapshot diffing - Large variant">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${metaTags}
        ${scripts.split("\n").slice(0, 5).join("\n")}
        <link rel="stylesheet" href="https://cdn.example.com/style1.css">
        <link rel="stylesheet" href="https://cdn.example.com/style2.css">
        <link rel="stylesheet" href="https://cdn.example.com/style3.css">
      </head>
      <body>
        <h1>DryftLink Snapshot Test - LARGE STATE</h1>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
        <p>This is the LARGE state with lots of content.</p>
        ${paddingCards}
        <h2>Images Gallery</h2>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
          ${images}
        </div>
        ${scripts.split("\n").slice(5).join("\n")}
        <script>
          window.testData = { state: "LARGE", timestamp: "${timestamp}" };
        </script>
      </body>
      </html>
    `;
  } else {
    // SMALL STATE: ~500 bytes, truly minimal
    return `<!DOCTYPE html>
<html>
<head>
<title>Test</title>
<meta charset="UTF-8">
</head>
<body>
<h1>DryftLink Test - SMALL</h1>
<p>Timestamp: ${timestamp}</p>
<p>This is the small state.</p>
<script>window.testData = { state: "SMALL" };</script>
</body>
</html>`;
  }
}

app.get("/", (req, res) => {
  // Determine state based on elapsed seconds (cycles every 40 seconds: 20 small, 20 large)
  const now = Date.now();
  const elapsed = (now / 1000) % 40; // Cycle every 40 seconds
  const isLarge = elapsed >= 20; // Large for second half

  const html = generateContent(isLarge);
  const state = isLarge ? "LARGE" : "SMALL";
  const elapsed_display = Math.floor(elapsed);

  res.set("X-Test-State", state);
  res.set("X-Test-Elapsed", elapsed_display);
  res.type("text/html");
  res.send(html);
});

app.get("/status", (req, res) => {
  const now = Date.now();
  const elapsed = (now / 1000) % 40;
  const isLarge = elapsed >= 20;

  res.json({
    state: isLarge ? "LARGE" : "SMALL",
    elapsed_seconds: Math.floor(elapsed),
    cycle_time: 40,
    next_change_in_seconds: Math.ceil(20 - (elapsed % 20)),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n🎯 DryftLink Test Website running at http://localhost:${PORT}`);
  console.log(`\n📋 How it works:`);
  console.log(`   - SMALL state (0-20s): ~500 bytes, minimal HTML`);
  console.log(`   - LARGE state (20-40s): ~5KB, lots of scripts/images/meta tags`);
  console.log(`   - Cycles every 40 seconds automatically`);
  console.log(`\n🧪 Test with DryftLink:`);
  console.log(`   1. Create site: http://localhost:3333`);
  console.log(`   2. Trigger check at 0s (SMALL)`);
  console.log(`   3. Trigger check at 25s (LARGE) - should see MAJOR change`);
  console.log(`   4. Trigger check at 45s (SMALL again) - should see MAJOR change back`);
  console.log(`\n📊 Status endpoint: http://localhost:${PORT}/status`);
  console.log("");
});
