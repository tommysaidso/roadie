// Overnight gap-filler for RoadieTV.
//
// Veo's daily quota ran out with b8 short a shot and b9/b10 with none — those
// two beats would play under a blank frame. This waits for the quota to roll,
// fills only what's missing, and stops the moment the episode is whole. Costs
// nothing while it waits and touches no GPU.
//
//   node scripts/fill-clips-overnight.mjs
//   node scripts/fill-clips-overnight.mjs --every 20   # minutes between tries
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CLIPS = path.join(ROOT, "public", "roadietv", "ep01", "clips");
const EP = path.join(ROOT, "content", "roadietv-ep01.json");

const everyArg = process.argv.indexOf("--every");
const EVERY_MIN = everyArg > -1 ? Number(process.argv[everyArg + 1]) || 20 : 20;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function wanted() {
  const ep = JSON.parse(fs.readFileSync(EP, "utf8"));
  const need = [];
  for (const b of ep.beats) {
    for (let i = 0; i < (b.shots || []).length; i++) {
      if (!fs.existsSync(path.join(CLIPS, `${b.id}-${i + 1}.mp4`))) need.push(`${b.id}-${i + 1}`);
    }
  }
  return need;
}

const stamp = () => new Date().toISOString().slice(11, 16);

(async () => {
  let round = 0;
  for (;;) {
    const missing = wanted();
    if (!missing.length) {
      console.log(`[${stamp()}] episode complete — all shots present. done.`);
      return;
    }
    round++;
    console.log(`[${stamp()}] round ${round}: ${missing.length} missing (${missing.join(", ")})`);

    const r = spawnSync("node", ["scripts/render-roadietv.mjs", "--clips"],
      { encoding: "utf8", cwd: ROOT });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    for (const line of out.split("\n")) {
      if (/\.mp4 —/.test(line) && !/cached/.test(line)) console.log(`   ${line.trim()}`);
    }

    const left = wanted();
    if (!left.length) {
      console.log(`[${stamp()}] episode complete — all ${20 - left.length} shots present. done.`);
      return;
    }
    if (/QUOTA EXHAUSTED|quota/i.test(out)) {
      console.log(`[${stamp()}] quota still spent — waiting ${EVERY_MIN} min (${left.length} to go)`);
    } else {
      console.log(`[${stamp()}] ${left.length} still missing for another reason — retrying in ${EVERY_MIN} min`);
    }
    await sleep(EVERY_MIN * 60 * 1000);
  }
})();
