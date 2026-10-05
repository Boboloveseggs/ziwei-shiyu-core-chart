/**
 * Generic adapter template.
 * Convert your existing chart object into the canonical ZDSM schema.
 * Do NOT place interpretation rules here. Only normalize field names/data shape.
 */

const CANONICAL_PALACES = ["命宫","兄弟","夫妻","子女","财帛","疾厄","迁移","交友","官禄","田宅","福德","父母"];

function normalizeStar(star){
  if(typeof star === "string") return {name: star, state: "平"};
  return {
    name: star.name || star.star || star.label || "",
    state: star.state || star.brightness || star.temple || "平"
  };
}

function normalizeTransform(tr){
  if(typeof tr === "string") return {type: tr};
  return {
    star: tr.star || tr.name || "",
    type: tr.type || tr.transform || "",
    dir: tr.dir ?? tr.direction ?? null
  };
}

export function adaptExistingChart(raw){
  // Replace this palace lookup with your website's own data structure.
  // Supported examples:
  // raw.houses["命宫"]
  // raw.palaces.find(x => x.name === "命宫")
  const lookup = (name) => {
    if(raw?.houses?.[name]) return raw.houses[name];
    if(Array.isArray(raw?.palaces)) return raw.palaces.find(x => (x.name || x.palace) === name) || {};
    return {};
  };

  const houses = {};
  for(const palace of CANONICAL_PALACES){
    const src = lookup(palace);
    houses[palace] = {
      main: (src.main || src.mainStars || src.majorStars || []).map(normalizeStar).filter(x => x.name),
      aux: (src.aux || src.auxStars || src.minorStars || []).map(x => typeof x === "string" ? x : (x.name || x.star || x.label)).filter(Boolean),
      malefic: (src.malefic || src.maleficStars || src.shaStars || []).map(x => typeof x === "string" ? x : (x.name || x.star || x.label)).filter(Boolean),
      transforms: (src.transforms || src.fourTransformations || []).map(normalizeTransform).filter(x => x.type),
      body: Boolean(src.body || src.isBodyPalace || raw?.bodyPalace === palace)
    };
  }

  return {
    meta: {
      name: raw?.meta?.name || raw?.name || "",
      gender: raw?.meta?.gender || raw?.gender || "",
      solar: raw?.meta?.solar || raw?.solar || "",
      lunar: raw?.meta?.lunar || raw?.lunar || "",
      bureau: raw?.meta?.bureau || raw?.bureau || ""
    },
    houses,
    timing: raw?.timing || {}
  };
}
