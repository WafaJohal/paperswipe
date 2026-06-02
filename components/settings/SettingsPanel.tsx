"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ZoteroCollection } from "@/hooks/useZotero";
import { GUEST_FILTERS_KEY, WORK_OVERRIDES_KEY } from "@/hooks/usePaperFeed";
import type { WorkType } from "@/lib/openalex";

interface VenueOption {
  id: string;
  name: string;
  issn: string | null;
  type: string;
}

interface UserSettings {
  orcid: string | null;
  zoteroUserId: string | null;
  zoteroCollectionKey: string | null;
  zoteroMaybeCollectionKey: string | null;
  filterKeywords: string[];
  filterDateRange: string;
  /** Venues stored as { name, id } — id is the OpenAlex source entity ID. */
  filterVenues: { name: string; id: string }[];
  // filterWorkType and filterOpenAccessOnly are NOT in the DB.
  // They live in sessionStorage via WORK_OVERRIDES_KEY.
  zoteroApiKeyMasked: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSettingsSaved: () => void;
  isGuest?: boolean;
}

const DATE_RANGE_OPTIONS = [
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "quarter", label: "Past 3 months" },
  { value: "year", label: "Past year" },
];

const WORK_TYPE_OPTIONS: { value: WorkType; label: string }[] = [
  { value: "", label: "All types" },
  { value: "article", label: "Articles" },
  { value: "review", label: "Reviews" },
  { value: "preprint", label: "Preprints" },
];

export function SettingsPanel({ open, onClose, onSettingsSaved, isGuest = false }: Props) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [orcid, setOrcid] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const [collections, setCollections] = useState<ZoteroCollection[]>([]);
  const [saveCollection, setSaveCollection] = useState("");
  const [maybeCollection, setMaybeCollection] = useState("");
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);
  const [filterDateRange, setFilterDateRange] = useState("month");
  const [filterVenues, setFilterVenues] = useState<{ name: string; id: string }[]>([]);
  const [filterWorkType, setFilterWorkType] = useState<WorkType>("");
  const [filterOpenAccessOnly, setFilterOpenAccessOnly] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [venueInput, setVenueInput] = useState("");
  const [venueSuggestions, setVenueSuggestions] = useState<VenueOption[]>([]);
  const [venueLoading, setVenueLoading] = useState(false);
  const venueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load current settings when panel opens
  useEffect(() => {
    if (!open) return;

    if (isGuest) {
      try {
        const raw = sessionStorage.getItem(GUEST_FILTERS_KEY);
        if (raw) {
          const f = JSON.parse(raw);
          setFilterKeywords(f.keywords ?? []);
          setFilterDateRange(f.dateRange ?? "month");
          setFilterVenues(f.venues ?? []);
        }
      } catch {}
      // workType / openAccessOnly use the shared WORK_OVERRIDES_KEY
      try {
        const raw = sessionStorage.getItem(WORK_OVERRIDES_KEY);
        if (raw) {
          const o = JSON.parse(raw);
          setFilterWorkType(o.workType ?? "");
          setFilterOpenAccessOnly(o.openAccessOnly ?? false);
        }
      } catch {}
      return;
    }

    // Load DB-backed settings
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then(({ settings: s }: { settings: UserSettings | null }) => {
        if (!s) return;
        setSettings(s);
        setOrcid(s.orcid ?? "");
        setUserId(s.zoteroUserId ?? "");
        setSaveCollection(s.zoteroCollectionKey ?? "");
        setMaybeCollection(s.zoteroMaybeCollectionKey ?? "");
        setFilterKeywords(s.filterKeywords ?? []);
        setFilterDateRange(s.filterDateRange ?? "month");
        setFilterVenues(s.filterVenues ?? []);
      });
    // Load session-only overrides (workType / openAccessOnly have no DB column yet)
    try {
      const raw = sessionStorage.getItem(WORK_OVERRIDES_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        setFilterWorkType(o.workType ?? "");
        setFilterOpenAccessOnly(o.openAccessOnly ?? false);
      }
    } catch {}
  }, [open, isGuest]);

  // Debounced venue search
  const handleVenueInputChange = useCallback((value: string) => {
    setVenueInput(value);
    setVenueSuggestions([]);
    if (venueDebounceRef.current) clearTimeout(venueDebounceRef.current);
    if (value.trim().length < 2) return;
    venueDebounceRef.current = setTimeout(async () => {
      setVenueLoading(true);
      try {
        const res = await fetch(
          `/api/openalex/sources?q=${encodeURIComponent(value.trim())}`
        );
        if (res.ok) {
          const data: { sources: VenueOption[] } = await res.json();
          setVenueSuggestions(data.sources);
        }
      } finally {
        setVenueLoading(false);
      }
    }, 350);
  }, []);

  const selectVenue = useCallback(
    (opt: VenueOption) => {
      if (!filterVenues.some((v) => v.id === opt.id)) {
        setFilterVenues((prev) => [...prev, { name: opt.name, id: opt.id }]);
      }
      setVenueInput("");
      setVenueSuggestions([]);
    },
    [filterVenues]
  );

  const validateAndFetchCollections = useCallback(async () => {
    if (!apiKey.trim() || !userId.trim()) {
      setValidationError("Enter both a User ID and API key.");
      return;
    }
    setValidating(true);
    setValidationError("");
    try {
      const res = await fetch(`https://api.zotero.org/users/${userId}/collections?limit=100`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Zotero-API-Version": "3",
        },
      });
      if (!res.ok) {
        setValidationError("Invalid credentials — check your User ID and API key.");
        return;
      }
      const data: { key: string; data: { name: string } }[] = await res.json();
      setCollections(data.map((c) => ({ key: c.key, name: c.data.name })));
    } catch {
      setValidationError("Could not reach Zotero. Check your connection.");
    } finally {
      setValidating(false);
    }
  }, [apiKey, userId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // workType and openAccessOnly are session-only for all users (no DB column yet)
      sessionStorage.setItem(
        WORK_OVERRIDES_KEY,
        JSON.stringify({ workType: filterWorkType, openAccessOnly: filterOpenAccessOnly })
      );

      if (isGuest) {
        sessionStorage.setItem(
          GUEST_FILTERS_KEY,
          JSON.stringify({
            keywords: filterKeywords,
            dateRange: filterDateRange,
            venues: filterVenues,
          })
        );
        sessionStorage.removeItem("paperswipe_feed_cache");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onSettingsSaved();
        return;
      }

      const body: Record<string, unknown> = {
        orcid: orcid.trim() || undefined,
        zoteroUserId: userId || undefined,
        zoteroCollectionKey: saveCollection || undefined,
        zoteroMaybeCollectionKey: maybeCollection || undefined,
        filterKeywords,
        filterDateRange,
        filterVenues,
        // filterWorkType and filterOpenAccessOnly are NOT sent to the API —
        // they are stored in sessionStorage via WORK_OVERRIDES_KEY above.
      };
      if (apiKey.trim()) body.zoteroApiKey = apiKey.trim();

      await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSettingsSaved();
    } finally {
      setSaving(false);
    }
  }, [isGuest, userId, saveCollection, maybeCollection, filterKeywords, filterDateRange, filterVenues, filterWorkType, filterOpenAccessOnly, apiKey, orcid, onSettingsSaved]);

  const addTag = (value: string, list: string[], setList: (v: string[]) => void, setInput: (v: string) => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.filter((t) => t !== tag));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#141414]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
          >
            {/* Handle */}
            <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-4">
              <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex shrink-0 items-center justify-between px-5 pb-4">
              <h2 className="text-lg font-bold text-white">Settings</h2>
              <button onClick={onClose} className="rounded-full p-1 text-white/40 hover:text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-10 space-y-8">

              {/* ── Guest sign-in nudge ── */}
              {isGuest && (
                <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-center">
                  <p className="text-xs text-white/40">
                    <a href="/api/auth/signin" className="font-semibold text-[#ff3b7f] hover:underline">Sign in</a>
                    {" "}to save papers to Zotero, get researcher matches, and sync your preferences across devices.
                  </p>
                </div>
              )}

              {/* ── ORCID section (signed-in only) ── */}
              {!isGuest && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">
                    Your ORCID
                  </h3>
                  <p className="mb-3 text-xs text-white/40">
                    Required to match with researchers who read your papers.{" "}
                    <a href="https://orcid.org" target="_blank" rel="noopener noreferrer" className="text-[#ff3b7f] hover:underline">
                      Get your ORCID →
                    </a>
                  </p>
                  <input
                    type="text"
                    value={orcid}
                    onChange={(e) => setOrcid(e.target.value)}
                    placeholder="0000-0001-2345-6789"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 font-mono outline-none focus:border-white/25"
                  />
                </section>
              )}

              {/* ── Zotero section (signed-in only) ── */}
              {!isGuest && (<section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">
                  Zotero
                </h3>
                <p className="mb-4 text-xs text-white/40">
                  Get your API key at{" "}
                  <a
                    href="https://www.zotero.org/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff3b7f] hover:underline"
                  >
                    zotero.org/settings/keys
                  </a>
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Zotero User ID
                    </label>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder="e.g. 1234567"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      API Key
                      {settings?.zoteroApiKeyMasked && (
                        <span className="ml-2 font-mono text-white/30">{settings.zoteroApiKeyMasked}</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Paste new key to update"
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                      />
                      <button
                        onClick={validateAndFetchCollections}
                        disabled={validating}
                        className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50 transition"
                      >
                        {validating ? "…" : "Validate"}
                      </button>
                    </div>
                    {validationError && (
                      <p className="mt-1.5 text-xs text-red-400">{validationError}</p>
                    )}
                    {collections.length > 0 && (
                      <p className="mt-1.5 text-xs text-green-400">
                        ✓ Connected — {collections.length} collections found
                      </p>
                    )}
                  </div>

                  {collections.length > 0 && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">
                          Save ♥ papers to
                        </label>
                        <select
                          value={saveCollection}
                          onChange={(e) => setSaveCollection(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
                        >
                          <option value="">— choose collection —</option>
                          {collections.map((c) => (
                            <option key={c.key} value={c.key}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-white/60">
                          Save ◎ Maybe papers to{" "}
                          <span className="text-white/25">(optional)</span>
                        </label>
                        <select
                          value={maybeCollection}
                          onChange={(e) => setMaybeCollection(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-white outline-none focus:border-white/25"
                        >
                          <option value="">— same as ♥ collection —</option>
                          {collections.map((c) => (
                            <option key={c.key} value={c.key}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </section>)}

              {/* ── Filters section ── */}
              <section>
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
                  Feed Filters
                </h3>

                <div className="space-y-4">
                  {/* Date range */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Publication date range
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {DATE_RANGE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setFilterDateRange(opt.value)}
                          className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                            filterDateRange === opt.value
                              ? "border-[#ff3b7f]/50 bg-[#ff3b7f]/10 text-[#ff3b7f]"
                              : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Keywords */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Topics / keywords
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addTag(keywordInput, filterKeywords, setFilterKeywords, setKeywordInput);
                          }
                        }}
                        placeholder="e.g. Human-Robot Interaction"
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                      />
                      <button
                        onClick={() => addTag(keywordInput, filterKeywords, setFilterKeywords, setKeywordInput)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white hover:bg-white/10 transition"
                      >
                        Add
                      </button>
                    </div>
                    {filterKeywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {filterKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70"
                          >
                            {kw}
                            <button onClick={() => removeTag(kw, filterKeywords, setFilterKeywords)} className="text-white/40 hover:text-white">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Venues — autocomplete against OpenAlex /sources */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Journals / venues
                    </label>
                    <p className="mb-2 text-xs text-white/30">
                      Search by name — select from suggestions to add.
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        value={venueInput}
                        onChange={(e) => handleVenueInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setVenueInput("");
                            setVenueSuggestions([]);
                          }
                        }}
                        placeholder="e.g. Nature, PLOS ONE…"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
                      />
                      {venueLoading && (
                        <span className="absolute right-3 top-2.5 text-xs text-white/30">
                          …
                        </span>
                      )}
                      {venueSuggestions.length > 0 && (
                        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-white/10 bg-[#1c1c1c] py-1 shadow-xl">
                          {venueSuggestions.map((opt) => (
                            <li key={opt.id}>
                              <button
                                onClick={() => selectVenue(opt)}
                                className="flex w-full flex-col px-3 py-2 text-left hover:bg-white/5"
                              >
                                <span className="text-sm text-white">{opt.name}</span>
                                <span className="text-xs text-white/30">
                                  {opt.type}
                                  {opt.issn ? ` · ISSN ${opt.issn}` : ""}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {filterVenues.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {filterVenues.map((v) => (
                          <span
                            key={v.id}
                            className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70"
                          >
                            {v.name}
                            <button
                              onClick={() =>
                                setFilterVenues((prev) =>
                                  prev.filter((x) => x.id !== v.id)
                                )
                              }
                              className="text-white/40 hover:text-white"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Work type */}
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">
                      Work type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {WORK_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setFilterWorkType(opt.value)}
                          className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                            filterWorkType === opt.value
                              ? "border-[#ff3b7f]/50 bg-[#ff3b7f]/10 text-[#ff3b7f]"
                              : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Open access toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white/80">Open access only</p>
                      <p className="text-xs text-white/30">Show only freely available papers</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={filterOpenAccessOnly}
                      onClick={() => setFilterOpenAccessOnly((v) => !v)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        filterOpenAccessOnly ? "bg-[#ff3b7f]" : "bg-white/10"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          filterOpenAccessOnly ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* Save button */}
            <div className="shrink-0 border-t border-white/5 p-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #ff3b7f 0%, #ff7b3b 100%)" }}
              >
                {saved ? "Saved ✓" : saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
