"use client";
import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export const DEFAULTS = {
  search:       "",
  status:       [],
  scoreMin:     0,
  scoreMax:     100,
  geniusMatch:  false,
  skills:       [],
  proficiency:  [],
  expBucket:    [],
  source:       [],
  timeline:     "",
  noticePeriod: [],
  sort:         "created_at",
  order:        "desc",
};

const SAVED_KEY = "gh_saved_searches";

function readSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); } catch { return []; }
}

// Parse URL search params back into filter state
function fromParams(params) {
  const get  = (k) => params.get(k) || "";
  const arr  = (k) => params.get(k) ? params.get(k).split(",").filter(Boolean) : [];
  const num  = (k, d) => { const v = params.get(k); return v !== null ? parseFloat(v) : d; };
  const bool = (k) => params.get(k) === "1";
  return {
    search:       get("q"),
    status:       arr("status"),
    scoreMin:     num("smin", 0),
    scoreMax:     num("smax", 100),
    geniusMatch:  bool("genius"),
    skills:       arr("skills"),
    proficiency:  arr("prof"),
    expBucket:    arr("exp"),
    source:       arr("src"),
    timeline:     get("tl"),
    noticePeriod: arr("notice"),
    sort:         get("sort") || "created_at",
    order:        get("order") || "desc",
  };
}

// Serialize filter state to URL params
function toParams(f) {
  const p = new URLSearchParams();
  if (f.search)                p.set("q",      f.search);
  if (f.geniusMatch)           p.set("genius", "1");
  if (f.scoreMin > 0)          p.set("smin",   f.scoreMin);
  if (f.scoreMax < 100)        p.set("smax",   f.scoreMax);
  if (f.status.length)         p.set("status", f.status.join(","));
  if (f.skills.length)         p.set("skills", f.skills.join(","));
  if (f.proficiency.length)    p.set("prof",   f.proficiency.join(","));
  if (f.expBucket.length)      p.set("exp",    f.expBucket.join(","));
  if (f.source.length)         p.set("src",    f.source.join(","));
  if (f.timeline)              p.set("tl",     f.timeline);
  if (f.noticePeriod.length)   p.set("notice", f.noticePeriod.join(","));
  if (f.sort !== "created_at") p.set("sort",   f.sort);
  if (f.order !== "desc")      p.set("order",  f.order);
  return p;
}

// Convert filter state to API query params
function toApiParams(f) {
  const p = {};
  if (f.geniusMatch) {
    p.score_min = 85;
    p.score_max = 100;
  } else {
    // Always send both bounds together so the backend range is unambiguous
    if (f.scoreMin > 0 || f.scoreMax < 100) {
      p.score_min = f.scoreMin;
      p.score_max = f.scoreMax;
    }
  }
  if (f.search)              p.search        = f.search;
  if (f.status.length)       p.status        = f.status.join(",");
  if (f.skills.length)       p.skills        = f.skills.join(",");
  if (f.proficiency.length)  p.proficiency   = f.proficiency.join(",");
  if (f.expBucket.length)    p.exp_bucket    = f.expBucket.join(",");
  if (f.source.length)       p.source        = f.source.join(",");
  if (f.timeline)            p.timeline      = f.timeline;
  if (f.noticePeriod.length) p.notice_period = f.noticePeriod.join(",");
  p.sort  = f.sort;
  p.order = f.order;
  return p;
}

export function useCandidateFilters() {
  const router     = useRouter();
  const pathname   = usePathname();
  const params     = useSearchParams();

  const [filters, setFilters]     = useState(() => ({ ...DEFAULTS, ...fromParams(params) }));
  const [saved, setSaved]         = useState(readSaved);
  const [saveLabel, setSaveLabel] = useState("");

  // Sync filters → URL whenever filters change
  useEffect(() => {
    const p = toParams(filters).toString();
    const current = params.toString();
    if (p !== current) {
      router.replace(`${pathname}${p ? `?${p}` : ""}`, { scroll: false });
    }
  }, [filters]); // eslint-disable-line

  const set = useCallback((key, value) =>
    setFilters((f) => ({ ...f, [key]: value })), []);

  const toggle = useCallback((key, value) =>
    setFilters((f) => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    }), []);

  const reset = useCallback(() => setFilters({ ...DEFAULTS }), []);

  // Active pills
  const activePills = useMemo(() => {
    const pills = [];
    if (filters.geniusMatch)                  pills.push({ key: "geniusMatch",  label: "⚡ Genius Match" });
    if (filters.scoreMin > 0 || filters.scoreMax < 100)
      pills.push({ key: "score", label: `Score ${filters.scoreMin}–${filters.scoreMax}` });
    filters.status.forEach((s)      => pills.push({ key: `status_${s}`,  label: s.replace(/_/g, " ") }));
    filters.skills.forEach((s)      => pills.push({ key: `skill_${s}`,   label: `🔧 ${s}` }));
    filters.proficiency.forEach((p) => pills.push({ key: `prof_${p}`,    label: p }));
    filters.expBucket.forEach((e)   => pills.push({ key: `exp_${e}`,     label: `${e} yrs` }));
    filters.source.forEach((s)      => pills.push({ key: `src_${s}`,     label: s === "bulk" ? "Bulk Upload" : "Individual" }));
    if (filters.timeline)                     pills.push({ key: "timeline",     label: `📅 ${filters.timeline}` });
    filters.noticePeriod.forEach((n)=> pills.push({ key: `notice_${n}`,  label: `Notice: ${n}` }));
    return pills;
  }, [filters]);

  const removePill = useCallback((key) => {
    if (key === "geniusMatch") return set("geniusMatch", false);
    if (key === "score")       return setFilters((f) => ({ ...f, scoreMin: 0, scoreMax: 100 }));
    if (key === "timeline")    return set("timeline", "");
    const prefixMap = { status_: "status", skill_: "skills", prof_: "proficiency", exp_: "expBucket", src_: "source", notice_: "noticePeriod" };
    for (const [prefix, field] of Object.entries(prefixMap)) {
      if (key.startsWith(prefix)) return toggle(field, key.slice(prefix.length));
    }
  }, [set, toggle]);

  // Saved searches
  const saveSearch = useCallback(() => {
    if (!saveLabel.trim()) return;
    const entry = { id: Date.now(), label: saveLabel.trim(), filters: { ...filters } };
    const next  = [entry, ...saved].slice(0, 10);
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaveLabel("");
  }, [saveLabel, filters, saved]);

  const loadSearch  = useCallback((entry) => setFilters({ ...DEFAULTS, ...entry.filters }), []);
  const deleteSaved = useCallback((id) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }, [saved]);

  const apiParams = useMemo(() => toApiParams(filters), [filters]);

  return {
    filters, set, toggle, reset,
    activePills, removePill,
    saved, saveLabel, setSaveLabel, saveSearch, loadSearch, deleteSaved,
    apiParams,
  };
}
