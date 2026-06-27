// Generates the PLAN array in lib/plan.ts from the source spreadsheet.
// Run from the frontend/ dir:  npm install -D fflate && node scripts/extract-plan.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";

const xlsxPath = "../French_A0_to_A2_56_day_plan.xlsx";
const buf = new Uint8Array(readFileSync(xlsxPath));
const files = unzipSync(buf);
const sheet = strFromU8(files["xl/worksheets/sheet2.xml"]);

// Sheet2 stores inline strings (<is><t>...</t></is>) and numbers (<v>...</v>). Parse rows in order.
const rowBlocks = sheet.split("<row").slice(1);
const rows = rowBlocks.map((block) => {
  const cells = [];
  for (const m of block.matchAll(/<c[^>]*>(.*?)<\/c>/gs)) {
    const cellContent = m[1];
    // Try inline string first (<is><t>...</t></is>)
    let t = cellContent.match(/<t[^>]*>(.*?)<\/t>/s);
    if (t) {
      cells.push(decode(t[1]));
    } else {
      // Try numeric value (<v>...</v>)
      const v = cellContent.match(/<v>(.*?)<\/v>/s);
      cells.push(v ? v[1] : "");
    }
  }
  return cells;
});
function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

// Row 0 is the header: Day, Week, Theme, Vocabulary, Grammar, Listening, Reading, Speaking, Writing, Checklist
const data = rows.slice(1).filter((r) => r[0]).map((r) => ({
  day: Number(r[0]),
  week: Number(r[1]),
  theme: r[2] ?? "",
  skills: {
    vocab: r[3] || undefined,
    grammar: r[4] || undefined,
    listening: r[5] || undefined,
    reading: r[6] || undefined,
    speaking: r[7] || undefined,
    writing: r[8] || undefined,
  },
  isReview: /review/i.test(r[2] ?? ""),
}));

const src = readFileSync("lib/plan.ts", "utf8");
const out = src.replace(
  /export const PLAN: PlanDay\[\] = \[\][^\n]*/,
  "export const PLAN: PlanDay[] = " + JSON.stringify(data, null, 2)
);
writeFileSync("lib/plan.ts", out);
console.log(`Wrote ${data.length} plan days into lib/plan.ts`);
