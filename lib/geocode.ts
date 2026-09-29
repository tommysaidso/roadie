// Canadian city gazetteer + resolver. Deterministic, offline, no key needed —
// the Maps browser key is referrer-restricted so server-side Google geocoding
// would be blocked anyway. Covers the top ~120 CA cities; unknown cities still
// save (lat/lng null) and can be fixed later in the profile.
export type Geo = { city: string; region: string; country: string; lat: number | null; lng: number | null };

const G: Record<string, [number, number, string]> = {
  // BC
  "vancouver":[49.2827,-123.1207,"BC"], "victoria":[48.4284,-123.3656,"BC"], "kelowna":[49.8880,-119.4960,"BC"],
  "kamloops":[50.6745,-120.3273,"BC"], "vernon":[50.2671,-119.2720,"BC"], "penticton":[49.4991,-119.5937,"BC"],
  "prince george":[53.9171,-122.7497,"BC"], "nelson":[49.4934,-117.2948,"BC"], "nanaimo":[49.1659,-123.9401,"BC"],
  "abbotsford":[49.0504,-122.3045,"BC"], "chilliwack":[49.1579,-121.9515,"BC"], "courtenay":[49.6877,-124.9994,"BC"],
  "cranbrook":[49.5122,-115.7694,"BC"], "fort st john":[56.2524,-120.8466,"BC"], "terrace":[54.5182,-128.6032,"BC"],
  "salmon arm":[50.7001,-119.2838,"BC"], "west kelowna":[49.8625,-119.5833,"BC"], "squamish":[49.7016,-123.1558,"BC"],
  "whistler":[50.1163,-122.9574,"BC"], "revelstoke":[50.9981,-118.1957,"BC"], "trail":[49.0966,-117.7117,"BC"],
  "castlegar":[49.3237,-117.6593,"BC"], "smithers":[54.7824,-127.1686,"BC"], "williams lake":[52.1417,-122.1417,"BC"],
  "quesnel":[52.9784,-122.4927,"BC"], "dawson creek":[55.7596,-120.2377,"BC"], "powell river":[49.8353,-124.5247,"BC"],
  // BC ring corridors — the small towns the rings actually run through. Without
  // these, an OSM site with no addr:city can't be snapped to a town and a venue
  // typed in by a local operator geocodes to nothing.
  // Fraser canyon + Sea-to-Sky
  "hope":[49.3830,-121.4414,"BC"], "yale":[49.5619,-121.4297,"BC"], "boston bar":[49.8697,-121.4444,"BC"],
  "north bend":[49.8756,-121.4506,"BC"], "lytton":[50.2317,-121.5817,"BC"], "spences bridge":[50.4222,-121.3417,"BC"],
  "ashcroft":[50.7222,-121.2833,"BC"], "cache creek":[50.8117,-121.3244,"BC"], "clinton":[51.0900,-121.5875,"BC"],
  "lillooet":[50.6861,-121.9403,"BC"], "pemberton":[50.3192,-122.8028,"BC"], "100 mile house":[51.6428,-121.2958,"BC"],
  "agassiz":[49.2333,-121.7667,"BC"], "harrison hot springs":[49.3000,-121.7833,"BC"], "mission":[49.1328,-122.3247,"BC"],
  "maple ridge":[49.2194,-122.6019,"BC"], "pitt meadows":[49.2211,-122.6897,"BC"], "langley":[49.1044,-122.6603,"BC"],
  "fort langley":[49.1670,-122.5786,"BC"], "aldergrove":[49.0578,-122.4711,"BC"], "merritt":[50.1122,-120.7862,"BC"],
  "logan lake":[50.4933,-120.8064,"BC"], "chase":[50.8194,-119.6853,"BC"], "princeton":[49.4589,-120.5103,"BC"],
  // Okanagan south
  "osoyoos":[49.0325,-119.4681,"BC"], "oliver":[49.1817,-119.5503,"BC"], "summerland":[49.6006,-119.6786,"BC"],
  "peachland":[49.7736,-119.7361,"BC"],
  // Kootenay
  "rossland":[49.0789,-117.8022,"BC"], "salmo":[49.1958,-117.2758,"BC"], "creston":[49.0955,-116.5135,"BC"],
  "kimberley":[49.6697,-115.9781,"BC"], "fernie":[49.5041,-115.0631,"BC"], "sparwood":[49.7333,-114.8833,"BC"],
  "elkford":[50.0236,-114.9200,"BC"], "invermere":[50.5069,-116.0353,"BC"], "golden":[51.2969,-116.9631,"BC"],
  "kaslo":[49.9139,-116.9111,"BC"], "nakusp":[50.2417,-117.8000,"BC"], "grand forks":[49.0333,-118.4333,"BC"],
  "christina lake":[49.0500,-118.2000,"BC"], "new denver":[49.9889,-117.3728,"BC"],
  // North / Highway 16
  "vanderhoof":[54.0167,-124.0167,"BC"], "houston":[54.3989,-126.6469,"BC"], "kitimat":[54.0524,-128.6534,"BC"],
  "prince rupert":[54.3150,-130.3208,"BC"], "burns lake":[54.2333,-125.7667,"BC"],
  // AB
  "calgary":[51.0447,-114.0719,"AB"], "edmonton":[53.5461,-113.4938,"AB"], "red deer":[52.2681,-113.8112,"AB"],
  // AB Crowsnest / Chinook belt
  "crowsnest pass":[49.6000,-114.4833,"AB"], "blairmore":[49.5947,-114.4517,"AB"], "coleman":[49.6314,-114.4906,"AB"],
  "pincher creek":[49.4869,-113.9436,"AB"], "fort macleod":[49.7208,-113.4131,"AB"], "claresholm":[50.0322,-113.5828,"AB"],
  "taber":[49.7867,-112.1494,"AB"], "high river":[50.5808,-113.8747,"AB"], "okotoks":[50.7256,-113.9750,"AB"],
  "lethbridge":[49.6956,-112.8451,"AB"], "medicine hat":[50.0405,-110.6764,"AB"], "grande prairie":[55.1707,-118.7947,"AB"],
  "banff":[51.1784,-115.5708,"AB"], "canmore":[51.0884,-115.3479,"AB"], "fort mcmurray":[56.7268,-111.3810,"AB"],
  "airdrie":[51.2917,-114.0144,"AB"], "st albert":[53.6305,-113.6256,"AB"],
  // SK / MB
  "saskatoon":[52.1332,-106.6700,"SK"], "regina":[50.4452,-104.6189,"SK"], "moose jaw":[50.3934,-105.5519,"SK"],
  "prince albert":[53.2033,-105.7531,"SK"], "swift current":[50.2851,-107.7972,"SK"],
  "winnipeg":[49.8951,-97.1384,"MB"], "brandon":[49.8485,-99.9501,"MB"], "steinbach":[49.5258,-96.6839,"MB"],
  // ON
  "toronto":[43.6532,-79.3832,"ON"], "ottawa":[45.4215,-75.6972,"ON"], "hamilton":[43.2557,-79.8711,"ON"],
  "london":[42.9849,-81.2453,"ON"], "kitchener":[43.4516,-80.4925,"ON"], "waterloo":[43.4643,-80.5204,"ON"],
  "windsor":[42.3149,-83.0364,"ON"], "kingston":[44.2312,-76.4860,"ON"], "guelph":[43.5448,-80.2482,"ON"],
  "barrie":[44.3894,-79.6903,"ON"], "sudbury":[46.4917,-80.9930,"ON"], "thunder bay":[48.3809,-89.2477,"ON"],
  "peterborough":[44.3091,-78.3197,"ON"], "st catharines":[43.1594,-79.2469,"ON"], "niagara falls":[43.0896,-79.0849,"ON"],
  "oshawa":[43.8971,-78.8658,"ON"], "mississauga":[43.5890,-79.6441,"ON"], "brampton":[43.7315,-79.7624,"ON"],
  "north bay":[46.3091,-79.4608,"ON"], "sault ste marie":[46.5219,-84.3461,"ON"], "sarnia":[42.9745,-82.4066,"ON"],
  "belleville":[44.1628,-77.3832,"ON"], "cornwall":[45.0212,-74.7300,"ON"],
  // QC
  "montreal":[45.5019,-73.5674,"QC"], "quebec city":[46.8131,-71.2075,"QC"], "quebec":[46.8131,-71.2075,"QC"],
  "laval":[45.6066,-73.7124,"QC"], "gatineau":[45.4765,-75.7013,"QC"], "sherbrooke":[45.4042,-71.8929,"QC"],
  "trois-rivieres":[46.3432,-72.5430,"QC"], "trois rivieres":[46.3432,-72.5430,"QC"], "longueuil":[45.5312,-73.5181,"QC"],
  "saguenay":[48.4260,-71.0725,"QC"], "drummondville":[45.8833,-72.4833,"QC"], "granby":[45.4001,-72.7305,"QC"],
  // Atlantic
  "halifax":[44.6488,-63.5752,"NS"], "sydney":[46.1368,-60.1942,"NS"], "truro":[45.3654,-63.2755,"NS"],
  "moncton":[46.0878,-64.7782,"NB"], "saint john":[45.2733,-66.0633,"NB"], "fredericton":[45.9636,-66.6431,"NB"],
  "charlottetown":[46.2382,-63.1311,"PE"],
  "st johns":[47.5615,-52.7126,"NL"], "corner brook":[48.9500,-57.9522,"NL"],
  // North
  "whitehorse":[60.7212,-135.0568,"YT"], "yellowknife":[62.4540,-114.3718,"NT"], "iqaluit":[63.7467,-68.5170,"NU"],
};

const PROV = new Set(["BC","AB","SK","MB","ON","QC","NS","NB","PE","NL","YT","NT","NU"]);

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,']/g, "").replace(/\s+/g, " ").trim();
}

// Accepts "Kelowna", "Kelowna BC", "Kelowna, BC", "Regina Saskatchewan" etc.
export function geocodeCity(input: string): Geo {
  const raw = String(input || "").trim();
  if (!raw) return { city: "", region: "", country: "CA", lat: null, lng: null };

  let city = raw, region = "";
  const m = raw.match(/^(.*?)[,\s]+([A-Za-z]{2})\.?$/);
  if (m && PROV.has(m[2].toUpperCase())) { city = m[1].trim(); region = m[2].toUpperCase(); }

  const hit = G[norm(city)];
  if (hit) return { city: title(city), region: region || hit[2], country: "CA", lat: hit[0], lng: hit[1] };
  // Unknown city: keep what the user said; region only if they supplied it.
  return { city: title(city), region, country: "CA", lat: null, lng: null };
}

/**
 * Towns matching what has been typed so far.
 *
 * Deliberately from OUR gazetteer rather than a places API. Two reasons that
 * matter more than the saved money: it only ever offers towns the circuit
 * actually reaches — nobody gets sent to Kelowna, Missouri — and it needs no
 * key in the browser, so there is nothing to leak or rate-limit.
 *
 * Ranking is prefix-first, then contains. Someone typing "leth" wants
 * Lethbridge above anything that merely contains those letters, and the towns
 * are short enough that nothing cleverer earns its keep.
 */
export type CitySuggestion = { city: string; region: string; lat: number; lng: number };

export function suggestCities(input: string, limit = 8): CitySuggestion[] {
  const q = norm(String(input || ""));
  if (q.length < 2) return [];
  const starts: CitySuggestion[] = [];
  const has: CitySuggestion[] = [];
  for (const key of Object.keys(G)) {
    const [lat, lng, region] = G[key];
    const row = { city: title(key), region, lat, lng };
    if (key.startsWith(q)) starts.push(row);
    else if (key.includes(q)) has.push(row);
    if (starts.length >= limit) break;
  }
  const byName = (a: CitySuggestion, b: CitySuggestion) => a.city.localeCompare(b.city);
  return [...starts.sort(byName), ...has.sort(byName)].slice(0, limit);
}

function title(s: string) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}
