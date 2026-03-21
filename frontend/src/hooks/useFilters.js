"use client";
import { useState, useCallback, useMemo } from "react";

export const FILTER_DEFAULTS = {
  search:          "",
  status:          [],
  scoreMin:        0,
  scoreMax:        100,
  geniusMatch:     false,
  skills:          [],
  proficiency:     [],          // Junior | Mid | Senior
  expBucket:       [],          // 0-2 | 3-5 | 5-8 | 10+
  commMin:         0,
  confidence:      [],          // High | Medium | Low
  source:          [],          // individual | bulk
  timeline:        "",          // 24h | week | month
  noticePeriod:    [],          // immediate | 15 | 30 | 60+
  sort:            "created_at",
  order:           "desc",
};

const STORAGE_KEY = "ai_recruiter_saved_searches";

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

export function useFilters() {
  const [filters, setFilters]       = useState({ ...FILTER_DEFAULTS });
  const [savedSearches, setSaved]   = useState(loadSaved);
  const [saveLabel, setSaveLabel]   = useState("");

  const set = useCallback((key, value) =>
    setFilters((f) => ({ ...f, [key]: value })), []);

  const toggle = useCallback((key, value) =>
    setFilters((f) => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    }), []);

  const reset = useCallback(() => setFilters({ ...FILTER_DEFAULTS }), []);

  const saveSearch = useCallback(() => {
    if (!saveLabel.trim()) return;
    const entry = { label: saveLabel.trim(), filters: { ...filters }, id: Date.now() };
    const next = [entry, ...savedSearches].slice(0, 10);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaveLabel("");
  }, [saveLabel, filters, savedSearches]);

  const loadSearch = useCallback((entry) => {
    setFilters({ ...FILTER_DEFAULTS, ...entry.filters });
  }, []);

  const deleteSaved = useCallback((id) => {
    const next = savedSearches.filter((s) => s.id !== id);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [savedSearches]);

  // Compute active filter pills for display
  const activePills = useMemo(() => {
    const pills = [];
    if (filters.geniusMatch)                    pills.push({ key: "geniusMatch",  label: "⚡ Genius Match" });
    if (filters.scoreMin > 0 || filters.scoreMax < 100)
      pills.push({ key: "score", label: `Score ${filters.scoreMin}–${filters.scoreMax}` });
    filters.status.forEach((s)       => pills.push({ key: `status_${s}`,      label: s.replace("_", " ") }));
    filters.skills.forEach((s)       => pills.push({ key: `skill_${s}`,       label: `🔧 ${s}` }));
    filters.proficiency.forEach((p)  => pills.push({ key: `prof_${p}`,        label: p }));
    filters.expBucket.forEach((e)    => pills.push({ key: `exp_${e}`,         label: `${e} yrs` }));
    if (filters.commMin > 0)                    pills.push({ key: "commMin",   label: `Comm ≥${filters.commMin}` });
    filters.confidence.forEach((c)   => pills.push({ key: `conf_${c}`,        label: `${c} Confidence` }));
    filters.source.forEach((s)       => pills.push({ key: `src_${s}`,         label: s === "bulk" ? "Bulk Upload" : "Individual" }));
    if (filters.timeline)                       pills.push({ key: "timeline",  label: `📅 ${filters.timeline}` });
    filters.noticePeriod.forEach((n) => pills.push({ key: `notice_${n}`,      label: `Notice: ${n}` }));
    return pills;
  }, [filters]);

  const removePill = useCallback((key) => {
    if (key === "geniusMatch")  return set("geniusMatch", false);
    if (key === "score")        return setFilters((f) => ({ ...f, scoreMin: 0, scoreMax: 100 }));
    if (key === "commMin")      return set("commMin", 0);
    if (key === "timeline")     return set("timeline", "");
    if (key.startsWith("status_"))  return toggle("status",      key.replace("status_", ""));
    if (key.startsWith("skill_"))   return toggle("skills",      key.replace("skill_", ""));
    if (key.startsWith("prof_"))    return toggle("proficiency",  key.replace("prof_", ""));
    if (key.startsWith("exp_"))     return toggle("expBucket",   key.replace("exp_", ""));
    if (key.startsWith("conf_"))    return toggle("confidence",  key.replace("conf_", ""));
    if (key.startsWith("src_"))     return toggle("source",      key.replace("src_", ""));
    if (key.startsWith("notice_"))  return toggle("noticePeriod", key.replace("notice_", ""));
  }, [set, toggle]);

  // Build query params object to send to API
  const toApiParams = useCallback(() => {
    const p = {};
    if (filters.geniusMatch)                    { p.score_min = 85; p.score_max = 100; }
    else {
      if (filters.scoreMin > 0)   p.score_min = filters.scoreMin;
      if (filters.scoreMax < 100) p.score_max = filters.scoreMax;
    }
    if (filters.search)                         p.search        = filters.search;
    if (filters.status.length)                  p.status        = filters.status.join(",");
    if (filters.skills.length)                  p.skills        = filters.skills.join(",");
    if (filters.proficiency.length)             p.proficiency   = filters.proficiency.join(",");
    if (filters.expBucket.length)               p.exp_bucket    = filters.expBucket.join(",");
    if (filters.commMin > 0)                    p.comm_min      = filters.commMin;
    if (filters.confidence.length)              p.confidence    = filters.confidence.join(",");
    if (filters.source.length)                  p.source        = filters.source.join(",");
    if (filters.timeline)                       p.timeline      = filters.timeline;
    if (filters.noticePeriod.length)            p.notice_period = filters.noticePeriod.join(",");
    p.sort  = filters.sort;
    p.order = filters.order;
    return p;
  }, [filters]);

  return {
    filters, set, toggle, reset,
    activePills, removePill,
    savedSearches, saveLabel, setSaveLabel, saveSearch, loadSearch, deleteSaved,
    toApiParams,
  };
}
