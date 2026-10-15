/* =========================================================================
   Classic Auto v6 - which 3D model (if any) the Studio may show for a car.

   The Studio never puts a generic car next to a listing's price. It shows a 3D model only when one exists for that
   car's own make and model (or a scan of the car itself); otherwise it shows the car's own photos.

   Where a model comes from, first match wins:
     1. car.model3d                     on the car itself (data/cars.json, once the stock importer publishes it)
     2. assets/models/cars3d.json       "id:<car id>"      a scan or model for one listed car
                                        "<make>/<model>"   a model of that make and model (slugs: "kia/seltos"),
                                                           optionally limited to the generation's years
     3. car.scan                        the importer's phone-scan path (models/cars/<id>.glb)

   A model entry:
     { "src": "assets/models/kia-seltos-2023.glb",        required, a .glb under assets/models/ or models/
       "src_lite": "assets/models/kia-seltos-2023-lite.glb", optional, a lighter file for phones
       "interior_src": "assets/models/kia-seltos-2023-cabin.jpg",  optional: a cabin model (.glb) or a 360 photo
                                                           (equirectangular .jpg/.webp, 2:1) for "Step inside"
       "kind": "same-model" | "scan",                     scan = this very car (only on car.model3d or an "id:" entry);
                                                           same-model = the same make and model
       "name": "Kia Seltos (2023 facelift)",              what the badge calls it
       "years": [2023, 2026],                             optional: only cars of these model years use it
       "rotate_y": 90,                                    optional: degrees, if the model's nose does not face the camera
       "cabin": false,                                    optional: false when the model has no modelled cabin (no "Cabin" view)
       "licence": "CC0-1.0" | "CC-BY-4.0" | "own" | "permission",
       "credit": "Creator name",                          required for CC-BY-4.0 and permission
       "credit_url": "https://...",                       the model's page (required for CC-BY-4.0 and permission)
       "as_of": "2026-10-15" }                            the date the licence was read
   An entry that breaks any rule is ignored (the photos show instead), never shown half-checked.
   ========================================================================= */

var LICENCES = { "CC0-1.0": "CC0 1.0", "CC-BY-4.0": "CC BY 4.0", "own": "Classic Auto's own scan", "permission": "used with permission" };
var SRC_RE = /^(assets\/models|models)\/[a-z0-9][a-z0-9\/_.-]*\.glb$/;
var INSIDE_RE = /^(assets\/models|models)\/[a-z0-9][a-z0-9\/_.-]*\.(glb|jpg|jpeg|webp)$/;

export function slug(s) { return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

/* one entry, checked; null when it may not be shown. perCar: the entry is for this one car (car.model3d or "id:<car id>");
   only such an entry may say it is a scan of the car itself, a make/model entry is always "same model, not this car" */
export function checkModel(m, car, perCar) {
  if (!m || typeof m !== "object") return null;
  if (typeof m.src !== "string" || !SRC_RE.test(m.src) || m.src.indexOf("..") >= 0) return null;
  var lic = m.licence;
  if (!LICENCES[lic]) return null;
  var needsCredit = lic === "CC-BY-4.0" || lic === "permission";
  var url = typeof m.credit_url === "string" && /^https:\/\/[^\s"<>]+$/.test(m.credit_url) ? m.credit_url : "";
  if (needsCredit && !(typeof m.credit === "string" && m.credit.trim() && url)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.as_of || "")) && lic !== "own") return null;
  if (m.years) {
    var y = Number(car && car.year);
    if (!Array.isArray(m.years) || m.years.length !== 2 || !(y >= m.years[0] && y <= m.years[1])) return null;
  }
  var kind = m.kind === "scan" && perCar ? "scan" : "same-model";
  var lite = typeof m.src_lite === "string" && SRC_RE.test(m.src_lite) && m.src_lite.indexOf("..") < 0 ? m.src_lite : null;
  var inside = typeof m.interior_src === "string" && INSIDE_RE.test(m.interior_src) && m.interior_src.indexOf("..") < 0 ? m.interior_src : null;
  return {
    src: m.src, srcLite: lite, interior: inside, interiorKind: inside ? (/\.glb$/.test(inside) ? "model" : "pano") : null,
    kind: kind, name: String(m.name || ((car ? car.make + " " + car.model : "") )).slice(0, 80),
    licence: lic, licenceLabel: LICENCES[lic], credit: needsCredit || m.credit ? String(m.credit || "").slice(0, 120) : "", creditUrl: url,
    asOf: m.as_of || "", rotateY: Math.max(-360, Math.min(360, Number(m.rotate_y) || 0)), cabin: m.cabin !== false && kind !== "scan"
  };
}

/* the model for this car, or null (then the Studio shows the car's own photos) */
export function resolveModel(car, manifest) {
  if (!car) return null;
  var models = manifest && manifest.models && typeof manifest.models === "object" ? manifest.models : {};
  var tries = [car.model3d, models["id:" + car.id], models[slug(car.make) + "/" + slug(car.model)]];
  for (var i = 0; i < tries.length; i++) { var ok = checkModel(tries[i], car, i < 2); if (ok) return ok; }
  if (typeof car.scan === "string" && /^models\/cars\/[a-z0-9-]+\.glb$/.test(car.scan)) {
    return { src: car.scan, srcLite: null, interior: null, interiorKind: null, kind: "scan", name: car.make + " " + car.model,
             licence: "own", licenceLabel: LICENCES.own, credit: "", creditUrl: "", asOf: "", rotateY: 0, cabin: false };
  }
  return null;
}

/* the manifest; a missing or broken file means "no models" (never an error on the page) */
export function loadManifest() {
  return fetch("assets/models/cars3d.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; });
}
