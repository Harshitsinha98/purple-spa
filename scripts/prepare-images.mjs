// One-off: converts the original photos in /images into web-optimised WebP files in /public/images.
// Run with: node scripts/prepare-images.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "images/";
const OUT = "public/images/";
const map = {
  "reception-front": "002fc1f5-22b8-4916-8028-f5216d4d4715.JPG",
  "corridor-neon": "02c9bef6-63cf-4ea3-8c5c-b0baa8ec7ad3.JPG",
  "reception-ceiling": "0b4458cc-f6a9-4b78-8924-57d8ba5f9d11.JPG",
  "reception-desk": "1359c59b-79fa-407c-b47b-46da43a76eef.JPG",
  "lounge-long": "234a5eb8-7d81-424f-a644-bc84282efcde.JPG",
  "corridor-jaali": "2537100f-d0c9-45a4-8788-6f1663baafef.JPG",
  "reception-blossom": "28b61e93-c2d7-4b80-851a-87295713da44.JPG",
  "room-chevron": "2bde3ddf-0be0-49ff-9622-f815f29fbaaf.JPG",
  "entry-blossom": "300febcc-4bf9-446f-9d3c-801ef4ed763d.JPG",
  "lounge-mural": "38be632f-3121-4c52-ac76-b0e6378da75b.JPG",
  "corridor-violet": "3fce339c-75d7-41f9-b91f-afb2e58fbaa2.JPG",
  "reception-wide": "44d55015-daee-450f-a289-7d70cd54974d.JPG",
  "art-wall": "5b6c9634-18ae-4df2-ac26-f441fafa2685.JPG",
  "reception-entry": "5e68f378-8153-4743-b67d-715f25e18f62.JPG",
  "room-stripes": "60fab225-d419-475c-ab70-6a701483f8da.JPG",
  "lounge-butterfly": "766f0049-269a-4d4d-a410-9c0959860aa1.JPG",
  "room-chevron-2": "92c9e13e-326b-4944-9878-4bfa2fcd2615.JPG",
  "room-magenta": "c0aa9964-60de-41d0-b0c4-1ab498a8b771.JPG",
  "reception-plants": "c33bdf11-38a8-4fb9-8390-c5690a4d76fd.JPG",
  "lounge-horses": "f4b3a32a-bb77-4e7f-89f1-3bfe11ec0f5b.JPG",
  "reception-sign": "fbe4f238-5c94-4f98-a1c4-ad7ed53ad9ee.JPG",
};
mkdirSync(OUT, { recursive: true });
for (const [name, file] of Object.entries(map)) {
  const img = sharp(SRC + file).rotate();
  await img.clone().resize(1600).webp({ quality: 78 }).toFile(`${OUT}${name}.webp`);
  await img.clone().resize(800).webp({ quality: 72 }).toFile(`${OUT}${name}-sm.webp`);
}
const logo = sharp(SRC + "33a26d0c-91b5-450a-99a6-58c1112f8468.JPG").rotate();
const meta = await logo.metadata();
const side = Math.min(meta.width, meta.height);
const square = logo.clone().extract({ left: Math.round((meta.width - side) / 2), top: Math.round((meta.height - side) / 2), width: side, height: side });
await square.clone().resize(1000).webp({ quality: 85 }).toFile(`${OUT}logo.webp`);
for (const s of [192, 512]) await square.clone().resize(s).png().toFile(`public/icons/icon-${s}.png`);
await square.clone().resize(180).png().toFile("public/icons/apple-touch-icon.png");
await square.clone().resize(1200, 630, { fit: "contain", background: "#2a1433" }).jpeg({ quality: 85 }).toFile(`${OUT}og.jpg`);
console.log("done");
