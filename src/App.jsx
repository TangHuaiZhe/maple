import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  applyPrimaryCoverSelection,
  hasRecordImages,
  loadAwardRecords,
  loadCatalog,
  loadCultivar,
  loadDevRecord,
  mutateDevImage,
  loadThumbnailManifest,
  readFavoriteIds,
  removeImageFromDetailRecord,
  resolveThumbnailUrl,
  saveDevRecord,
  setRecordPrimaryCover,
  uniqueValues,
  writeFavoriteIds,
} from "./dataUtils.mjs";
import { prepareImageFilesForUpload } from "./imageUpload.mjs";
import { UI_STRINGS } from "./i18n.mjs";
import {
  assertEditableRecordShape,
  mergeEditableRecord,
  pickEditableRecord,
} from "./devEditorUtils.mjs";
import {
  compareCultivars,
  getAlphabetSections,
  getAlphaGroup,
  getCoverSourceKey,
  getPreferredDescription,
  getVisibleCover,
  getVisibleImagePaths,
  isDiscoveryHiddenRecord,
  matchesQuery,
  normalizeSearchText,
  summarizeText,
} from "./cultivarViewUtils.mjs";
import {
  RHS_FIELD_LABELS,
  getChineseAliases,
  getDetailTraits,
  getSizeSummary,
} from "./rhsUtils.mjs";
import { resolveAwardSelections } from "./awardsUtils.mjs";
import {
  DISCOVERY_VISIBILITY_STORAGE_KEY,
  readDiscoveryVisibility,
  writeDiscoveryVisibility,
} from "./preferences.mjs";
import POPULAR_IDS from "../public/data/popular-ids.json";

const PAGE_SIZE = 96;
const DETAIL_GALLERY_PAGE_SIZE = 10;
const SEARCH_ALL_VALUE = "__all__";
const DEV_EDITOR_ENABLED = import.meta.env.DEV;
const FAVORITES_STORAGE_KEY = "maple-favorites";

function getCoverSourceLabel(sourceKey, locale = "zh") {
  return UI_STRINGS[locale]?.coverSource?.[sourceKey] || UI_STRINGS.zh.coverSource[sourceKey] || sourceKey;
}

function FavoriteToggleButton({ active, onClick, strings, className = "" }) {
  return (
    <button
      type="button"
      className={`favorite-toggle ${active ? "active" : ""} ${className}`.trim()}
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? strings.common.removeFavorite : strings.common.addFavorite}
    >
      <span className="favorite-toggle-icon" aria-hidden="true">{active ? "♥" : "♡"}</span>
      <span className="favorite-toggle-label">{active ? strings.common.favorited : strings.common.addFavorite}</span>
    </button>
  );
}

function DefinitionList({ items }) {
  return (
    <dl className="detail-list">
      {items.filter(([, value]) => value).map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ImageLightbox({ images, activeIndex, title, subtitle, onClose, onStep, strings }) {
  const currentImage = images[activeIndex];

  if (!currentImage) {
    return null;
  }

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} ${strings.lightbox.dialogSuffix}`}
      onClick={onClose}
    >
      <div className="lightbox-title">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <button
        type="button"
        className="lightbox-close"
        onClick={onClose}
        aria-label={strings.lightbox.close}
      >
        {strings.lightbox.close}
      </button>
      {images.length > 1 ? (
        <button
          type="button"
          className="lightbox-nav lightbox-nav-prev"
          onClick={(event) => {
            event.stopPropagation();
            onStep(-1);
          }}
          aria-label={strings.lightbox.previous}
        >
          ‹
        </button>
      ) : null}
      <div
        className="lightbox-stage"
        onClick={(event) => event.stopPropagation()}
      >
        <img src={currentImage} alt={title} />
        <p className="lightbox-meta">
          {activeIndex + 1} / {images.length}
        </p>
      </div>
      {images.length > 1 ? (
        <button
          type="button"
          className="lightbox-nav lightbox-nav-next"
          onClick={(event) => {
            event.stopPropagation();
            onStep(1);
          }}
          aria-label={strings.lightbox.next}
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

function CultivarCard({ item, prioritizeEditorialImage = false, strings, locale, isFavorite, onToggleFavorite, thumbnailManifest }) {
  const description = getPreferredDescription(item, locale);
  const cover = getVisibleCover(item, { prioritizeEditorial: prioritizeEditorialImage });
  const coverSrc = resolveThumbnailUrl(cover, thumbnailManifest, 480);
  const coverSourceKey = getCoverSourceKey(item, cover);
  const coverSourceLabel = getCoverSourceLabel(coverSourceKey, locale);

  return (
    <article className="cultivar-card">
      <FavoriteToggleButton
        active={isFavorite}
        onClick={() => onToggleFavorite(item.id)}
        strings={strings}
        className="favorite-toggle-card"
      />
      <Link className="cultivar-visual" to={`/cultivar/${item.id}`}>
        {cover ? (
          <img src={coverSrc} alt={item.display_name || item.canonical_name} loading="lazy" />
        ) : (
          <div className="image-fallback">{strings.common.noImage}</div>
        )}
        <span className={`cover-chip source-${coverSourceKey === "mrMaple" ? "mr-maple" : coverSourceKey}`}>{coverSourceLabel}</span>
      </Link>
      <div className="cultivar-meta">
        <div className="cultivar-kicker">
          <span>{getAlphaGroup(item)}</span>
          {item.top_category ? <span>{item.top_category}</span> : null}
          {item.web_group ? <span>{item.web_group}</span> : null}
        </div>
        <h3 className="cultivar-title">
          <Link to={`/cultivar/${item.id}`}>{item.display_name || item.canonical_name}</Link>
        </h3>
        {item.chinese_name ? <p className="cultivar-chinese">{item.chinese_name}</p> : null}
        <p className="cultivar-scientific">{item.scientific_name || item.canonical_name}</p>
        <p className="cultivar-description">{summarizeText(description, locale)}</p>
      </div>
    </article>
  );
}

function AlphabetToolbar({ letters, onSelect, strings }) {
  return (
    <nav className="alpha-toolbar" aria-label={strings.catalog.alphaLabel}>
      {letters.map((letter) => (
        <button
          key={letter}
          type="button"
          className="alpha-link"
          onClick={() => onSelect(letter)}
        >
          {letter}
        </button>
      ))}
    </nav>
  );
}

function CatalogSections({ sections, prioritizeEditorialImage, strings, locale, favoriteSet, onToggleFavorite, thumbnailManifest }) {
  if (!sections.length) {
    return <div className="empty-state">{strings.common.noResults}</div>;
  }

  return (
    <div className="catalog-sections">
      {sections.map(([letter, items]) => (
        <section key={letter} id={`section-${letter}`} className="catalog-section">
          <div className="catalog-section-head">
            <h2>{letter}</h2>
            <p>{strings.catalog.itemCount(items.length)}</p>
          </div>
          <div className="catalog-grid">
            {items.map((item) => (
              <CultivarCard
                key={item.id}
                item={item}
                prioritizeEditorialImage={prioritizeEditorialImage}
                strings={strings}
                locale={locale}
                isFavorite={favoriteSet.has(item.id)}
                onToggleFavorite={onToggleFavorite}
                thumbnailManifest={thumbnailManifest}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RHSAwardPage({ records, strings, locale, favoriteSet, onToggleFavorite, thumbnailManifest }) {
  const [awardRecords, setAwardRecords] = useState([]);
  const resolvedSelections = resolveAwardSelections({ records, awardRecords });

  useEffect(() => {
    let isMounted = true;

    loadAwardRecords()
      .then((data) => {
        if (isMounted) {
          setAwardRecords(data);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAwardRecords([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="page-shell">
      <section className="search-panel">
        <div className="section-head">
          <h1>{strings.awards.title}</h1>
          <p>{strings.awards.subtitle}</p>
        </div>
        <div className="result-summary">{strings.awards.count(resolvedSelections.length)}</div>
      </section>

      <div className="catalog-sections">
        <section className="catalog-section">
          <div className="catalog-grid">
            {resolvedSelections.map((item) => (
              <CultivarCard
                key={item.id}
                item={item}
                prioritizeEditorialImage
                strings={strings}
                locale={locale}
                isFavorite={favoriteSet.has(item.id)}
                onToggleFavorite={onToggleFavorite}
                thumbnailManifest={thumbnailManifest}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function PaginatedCatalog({ records, prioritizeEditorialImage = false, strings, locale, favoriteSet, onToggleFavorite, thumbnailManifest }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingLetter, setPendingLetter] = useState("");
  const sentinelRef = useRef(null);
  const firstRecordId = records[0]?.id || "";
  const lastRecordId = records[records.length - 1]?.id || "";
  const allSections = getAlphabetSections(records);
  const visibleRecords = records.slice(0, visibleCount);
  const hasMore = visibleRecords.length < records.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setPendingLetter("");
  }, [records.length, firstRecordId, lastRecordId]);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        setVisibleCount((count) => Math.min(count + PAGE_SIZE, records.length));
      },
      {
        rootMargin: "0px 0px 320px 0px",
      },
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, records.length, visibleCount]);

  useEffect(() => {
    if (!pendingLetter) {
      return undefined;
    }

    const frameId = requestAnimationFrame(() => {
      document.getElementById(`section-${pendingLetter}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingLetter("");
    });

    return () => cancelAnimationFrame(frameId);
  }, [pendingLetter, visibleCount]);

  if (!records.length) {
    return <div className="empty-state">{strings.common.noResults}</div>;
  }

  const sections = getAlphabetSections(visibleRecords);
  const letters = allSections.map(([letter]) => letter);

  function handleLetterSelect(letter) {
    const target = document.getElementById(`section-${letter}`);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    let requiredCount = 0;
    for (const [sectionLetter, items] of allSections) {
      requiredCount += items.length;
      if (sectionLetter === letter) {
        break;
      }
    }

    setPendingLetter(letter);
    setVisibleCount((count) => Math.max(count, requiredCount));
  }

  return (
    <>
      <AlphabetToolbar letters={letters} onSelect={handleLetterSelect} strings={strings} />
      <CatalogSections
        sections={sections}
        prioritizeEditorialImage={prioritizeEditorialImage}
        strings={strings}
        locale={locale}
        favoriteSet={favoriteSet}
        onToggleFavorite={onToggleFavorite}
        thumbnailManifest={thumbnailManifest}
      />
      <div className="catalog-actions">
        <p className="catalog-progress">
          {strings.catalog.progress(visibleRecords.length, records.length)}
        </p>
        {hasMore ? <p className="catalog-progress">{strings.catalog.autoLoadMore}</p> : null}
        {hasMore ? <div ref={sentinelRef} className="catalog-sentinel" aria-hidden="true" /> : null}
      </div>
    </>
  );
}

function HomePage({ records, strings, locale, favoriteSet, onToggleFavorite, thumbnailManifest }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  const initialCategory = new URLSearchParams(location.search).get("category") || SEARCH_ALL_VALUE;
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [showMissingImagesOnly, setShowMissingImagesOnly] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const categories = [{ value: SEARCH_ALL_VALUE, label: strings.home.allCategories }, ...new Set(records.map((item) => item.top_category).filter(Boolean)).values().map((item) => ({ value: item, label: item }))];

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== SEARCH_ALL_VALUE) params.set("category", category);
    navigate({ pathname: "/catalog", search: params.toString() }, { replace: true });
  }, [query, category, navigate]);

  const normalizedQuery = normalizeSearchText(deferredQuery);
  const filtered = records.filter((item) => {
    const categoryMatch = category === SEARCH_ALL_VALUE || item.top_category === category;
    const imageMatch = !showMissingImagesOnly || !hasRecordImages(item);
    return categoryMatch && imageMatch && matchesQuery(item, normalizedQuery);
  });

  return (
    <div className="page-shell">
      <section className="search-panel">
        <div className="atlas-search-panel">
          <div className="search-controls">
            <label className="field">
              <span>{strings.home.searchLabel}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={strings.home.searchPlaceholder}
              />
            </label>
            <label className="field">
              <span>{strings.home.categoryLabel}</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {DEV_EDITOR_ENABLED ? (
            <label className="dev-filter-toggle">
              <input
                type="checkbox"
                checked={showMissingImagesOnly}
                onChange={(event) => setShowMissingImagesOnly(event.target.checked)}
              />
              <span>{strings.common.missingImagesOnly}</span>
            </label>
          ) : null}
          <div className="result-summary">{strings.home.result(filtered.length)}</div>
        </div>
      </section>
      <PaginatedCatalog
        records={filtered}
        prioritizeEditorialImage
        strings={strings}
        locale={locale}
        favoriteSet={favoriteSet}
        onToggleFavorite={onToggleFavorite}
        thumbnailManifest={thumbnailManifest}
      />
    </div>
  );
}

function PopularPage({ records, strings, locale, favoriteSet, onToggleFavorite, thumbnailManifest }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const recordMap = new Map(records.map((r) => [r.id, r]));
  const popularItems = POPULAR_IDS
    .map((id) => recordMap.get(id))
    .filter(Boolean);
  const normalizedQuery = normalizeSearchText(deferredQuery);
  const filteredItems = popularItems.filter((item) => matchesQuery(item, normalizedQuery));

  return (
    <div className="page-shell">
      <section className="search-panel">
        <div className="section-head">
          <h1>{strings.popular.title}</h1>
          <p>{strings.popular.subtitle}</p>
        </div>
        <div className="search-controls" style={{ gridTemplateColumns: "1fr", marginTop: "14px" }}>
          <label className="field">
            <span>{strings.home.searchLabel}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={strings.home.searchPlaceholder}
            />
          </label>
        </div>
        <div className="result-summary">{strings.popular.count(filteredItems.length)}</div>
      </section>

      <div className="catalog-sections">
        <section className="catalog-section">
          <div className="catalog-grid">
            {filteredItems.map((item) => (
              <CultivarCard
                key={item.id}
                item={item}
                prioritizeEditorialImage
                strings={strings}
                locale={locale}
                isFavorite={favoriteSet.has(item.id)}
                onToggleFavorite={onToggleFavorite}
                thumbnailManifest={thumbnailManifest}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FavoritesPage({ records, strings, locale, onToggleFavorite, thumbnailManifest }) {
  if (!records.length) {
    return (
      <div className="page-shell">
        <section className="search-panel">
          <div className="section-head">
            <h1>{strings.favorites.title}</h1>
            <p>{strings.favorites.subtitle}</p>
          </div>
        </section>
        <div className="empty-state favorites-empty-state">
          <h2>{strings.favorites.emptyTitle}</h2>
          <p>{strings.favorites.emptyText}</p>
          <Link className="detail-toggle" to="/">{strings.favorites.browseCta}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <section className="search-panel">
        <div className="section-head">
          <h1>{strings.favorites.title}</h1>
          <p>{strings.favorites.subtitle}</p>
        </div>
        <div className="result-summary">{strings.favorites.count(records.length)}</div>
      </section>
      <PaginatedCatalog
        records={records}
        strings={strings}
        locale={locale}
        favoriteSet={new Set(records.map((record) => record.id))}
        onToggleFavorite={onToggleFavorite}
        thumbnailManifest={thumbnailManifest}
      />
    </div>
  );
}

function LegacySearchRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: "/", search: location.search }} replace />;
}

function DetailPage({ records, locale, strings, favoriteSet, onToggleFavorite, thumbnailManifest }) {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [previewIndex, setPreviewIndex] = useState(null);
  const [visibleImageCount, setVisibleImageCount] = useState(DETAIL_GALLERY_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorBaseRecord, setEditorBaseRecord] = useState(null);
  const [editorDraft, setEditorDraft] = useState("");
  const [editorState, setEditorState] = useState("idle");
  const [editorMessage, setEditorMessage] = useState("");
  const [uploadState, setUploadState] = useState("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [compressUploads, setCompressUploads] = useState(true);
  const [coverSavePath, setCoverSavePath] = useState("");
  const [imageActionPath, setImageActionPath] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const previewImages = item ? uniqueValues([getVisibleCover(item), ...getVisibleImagePaths(item)]) : [];
  const galleryImages = item ? getVisibleImagePaths(item) : [];
  const visibleGalleryImages = galleryImages.slice(0, visibleImageCount);
  const hasMoreGalleryImages = visibleGalleryImages.length < galleryImages.length;
  const devEditorText = locale === "en"
    ? {
        title: "Dev Editor",
        subtitle: "Edit key JSON fields for the current cultivar. Hidden in production builds.",
        closedHint: "Open the editor to modify the raw record and regenerate public data immediately.",
        note: "Only key fields are exposed here. Images, RHS, Mr Maple, Herter, and NCSU download metadata are preserved from the raw record.",
        open: "Edit",
        close: "Close",
        reset: "Reset",
        save: "Save",
        uploadImages: "Upload Images",
        compressUploads: "Compress images before upload",
        loading: "Loading editable JSON…",
        saving: "Saving…",
        saved: "Saved. Raw data updated and public data regenerated.",
        jsonLabel: "Editable JSON",
      }
    : {
        title: "开发编辑",
        subtitle: "直接编辑当前品种的关键 JSON 字段。生产构建中会自动隐藏。",
        closedHint: "打开编辑器后可修改 raw 记录，并立即重新生成前端数据。",
        note: "这里只暴露关键字段。图片、RHS、Mr Maple、Herter、NCSU 的下载元数据会保留，不会被这块编辑器覆盖。",
        open: "编辑",
        close: "关闭",
        reset: "重置",
        save: "保存",
        uploadImages: "上传图片",
        compressUploads: "上传前自动压缩图片",
        loading: "正在加载可编辑 JSON…",
        saving: "正在保存…",
        saved: "保存完成，raw 数据与前端生成数据都已更新。",
        jsonLabel: "可编辑 JSON",
      };

  useEffect(() => {
    setStatus("loading");
    setError("");
    setPreviewIndex(null);
    setVisibleImageCount(DETAIL_GALLERY_PAGE_SIZE);
    setSearchQuery("");
    setEditorOpen(false);
    setEditorBaseRecord(null);
    setEditorDraft("");
    setEditorState("idle");
    setEditorMessage("");

    loadCultivar(id)
      .then((data) => {
        setItem(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (err && err.code === "NOT_FOUND") {
          setItem(null);
          setStatus("ready");
          return;
        }
        setItem(null);
        setError(err.message);
        setStatus("error");
      });
  }, [id]);

  useEffect(() => {
    if (previewIndex == null) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setPreviewIndex(null);
      }

      if (event.key === "ArrowLeft") {
        setPreviewIndex((current) => {
          if (current == null || !previewImages.length) return current;
          return (current - 1 + previewImages.length) % previewImages.length;
        });
      }

      if (event.key === "ArrowRight") {
        setPreviewIndex((current) => {
          if (current == null || !previewImages.length) return current;
          return (current + 1) % previewImages.length;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewIndex, previewImages]);

  if (status === "loading") {
    return (
      <div className="page-shell">
        <div className="empty-state">{strings.detail.loading}</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="page-shell">
        <div className="empty-state">
          <h1>{strings.detail.loadFailed}</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const description = item ? getPreferredDescription(item, locale) : "";

  if (!item) {
    return (
      <div className="page-shell">
        <div className="empty-state">
          <h1>{strings.detail.notFoundTitle}</h1>
          <p>{strings.detail.notFoundText}</p>
        </div>
      </div>
    );
  }

  const rhs = item.rhs;
  const rhsEnglish = item.rhs_en || item.rhs;
  const rhsLabels = RHS_FIELD_LABELS[locale] || RHS_FIELD_LABELS.zh;
  const cover = getVisibleCover(item);
  const coverSrc = resolveThumbnailUrl(cover, thumbnailManifest, 960);
  const isFavorite = favoriteSet.has(item.id);
  const sizeSummary = getSizeSummary(rhs, rhsEnglish, locale);
  const detailTraits = getDetailTraits(item, locale, rhsLabels);
  const chineseAliases = getChineseAliases(item);
  const normalizedSearchQuery = normalizeSearchText(deferredSearchQuery);
  const matchingCultivars = normalizedSearchQuery
    ? records
        .filter((record) => record.id !== item.id && matchesQuery(record, normalizedSearchQuery))
        .sort(compareCultivars)
        .slice(0, 8)
    : [];

  function openPreview(imagePath) {
    const index = previewImages.indexOf(imagePath);
    setPreviewIndex(index >= 0 ? index : 0);
  }

  function stepPreview(step) {
    setPreviewIndex((current) => {
      if (current == null || !previewImages.length) return current;
      return (current + step + previewImages.length) % previewImages.length;
    });
  }

  async function handleEditorToggle() {
    if (editorOpen) {
      setEditorOpen(false);
      return;
    }

    setEditorOpen(true);
    setEditorState("loading");
    setEditorMessage("");

    try {
      const record = await loadDevRecord(id);
      setEditorBaseRecord(record);
      setEditorDraft(JSON.stringify(pickEditableRecord(record), null, 2));
      setEditorState("idle");
    } catch (err) {
      setEditorState("error");
      setEditorMessage(err.message);
    }
  }

  function handleEditorReset() {
    if (!editorBaseRecord) {
      return;
    }

    setEditorDraft(JSON.stringify(pickEditableRecord(editorBaseRecord), null, 2));
    setEditorState("idle");
    setEditorMessage("");
  }

  async function handleEditorSave() {
    if (!editorBaseRecord) {
      return;
    }

    setEditorState("saving");
    setEditorMessage("");

    try {
      const parsed = JSON.parse(editorDraft);
      assertEditableRecordShape(parsed);
      const nextRecord = mergeEditableRecord(editorBaseRecord, parsed);
      const savedRecord = await saveDevRecord(id, nextRecord);
      const nextItem = await loadCultivar(id);

      setEditorBaseRecord(savedRecord);
      setEditorDraft(JSON.stringify(pickEditableRecord(savedRecord), null, 2));
      setItem(nextItem);
      setEditorState("saved");
      setEditorMessage(devEditorText.saved);
    } catch (err) {
      setEditorState("error");
      setEditorMessage(err.message);
    }
  }

  async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || !files.length) return;

    setUploadState("uploading");
    setUploadMessage("");
    setCoverSavePath("");

    try {
      const formData = new FormData();
      const uploadFiles = await prepareImageFilesForUpload(files, { compress: compressUploads });

      for (const file of uploadFiles) {
        formData.append("images", file, file.name);
      }

      const res = await fetch(`/__dev/upload-image/${encodeURIComponent(id)}`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const nextItem = await loadCultivar(id);
      setItem(nextItem);
      setUploadState("done");
      setUploadMessage(`已上传 ${uploadFiles.length} 张图片`);
      event.target.value = "";
    } catch (err) {
      setUploadState("error");
      setUploadMessage(err.message);
    }
  }

  async function handleSetPrimaryCover(imagePath) {
    const previousItem = item;
    const previousEditorBaseRecord = editorBaseRecord;

    setCoverSavePath(imagePath);
    setEditorMessage("");
    setItem((current) => applyPrimaryCoverSelection(current, imagePath));
    setEditorBaseRecord((current) => (current ? setRecordPrimaryCover(current, imagePath) : current));

    try {
      const baseRecord = editorBaseRecord || await loadDevRecord(id);
      const nextRecord = setRecordPrimaryCover(baseRecord, imagePath);
      const savedRecord = await saveDevRecord(id, nextRecord);
      const nextItem = await loadCultivar(id);

      setEditorBaseRecord(savedRecord);
      setEditorDraft(JSON.stringify(pickEditableRecord(savedRecord), null, 2));
      setItem(nextItem);
      setEditorState("saved");
      setEditorMessage(locale === "en" ? "Cover image updated" : "主图已更新");
    } catch (err) {
      setItem(previousItem);
      setEditorBaseRecord(previousEditorBaseRecord);
      setEditorState("error");
      setEditorMessage(err.message);
    } finally {
      setCoverSavePath("");
    }
  }

  async function handleImageAction(imagePath, action) {
    const actionLabel = action === "delete" ? strings.common.deleteImage : strings.common.hideImage;
    const confirmText = locale === "en"
      ? `Confirm ${actionLabel.toLowerCase()} this image?`
      : `确认${actionLabel}这张图片吗？`;

    if (!window.confirm(confirmText)) {
      return;
    }

    const previousItem = item;
    const previousEditorBaseRecord = editorBaseRecord;
    setImageActionPath(`${action}:${imagePath}`);
    setEditorMessage("");
    setItem((current) => removeImageFromDetailRecord(current, imagePath));

    try {
      await mutateDevImage(id, imagePath, action);
      const nextRecord = await loadDevRecord(id);
      const nextItem = await loadCultivar(id);
      setEditorBaseRecord(nextRecord);
      setEditorDraft(JSON.stringify(pickEditableRecord(nextRecord), null, 2));
      setItem(nextItem);
      setEditorState("saved");
      setEditorMessage(locale === "en" ? `${actionLabel} succeeded` : `${actionLabel}成功`);
    } catch (err) {
      setItem(previousItem);
      setEditorBaseRecord(previousEditorBaseRecord);
      setEditorState("error");
      setEditorMessage(err.message);
    } finally {
      setImageActionPath("");
    }
  }

  return (
    <>
      <div className="page-shell detail-shell">
        <section className="search-panel detail-search-shell">
          <div className="detail-search-panel">
            <label className="detail-search-inline" htmlFor="detail-search-input">
              <span>{strings.detail.searchLabel}</span>
              <input
                id="detail-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={strings.detail.searchPlaceholder}
              />
            </label>
            <p className="detail-search-hint">
              {normalizedSearchQuery
                ? (
                  matchingCultivars.length
                    ? strings.detail.searchResults(matchingCultivars.length)
                    : strings.detail.searchNoResults
                )
                : strings.detail.searchHint}
            </p>
            {normalizedSearchQuery && matchingCultivars.length ? (
              <div className="detail-search-results">
                {matchingCultivars.map((record) => (
                  <Link
                    key={record.id}
                    className="detail-search-result"
                    to={`/cultivar/${record.id}`}
                  >
                    <span className="detail-search-result-copy">
                      <strong>{record.display_name || record.canonical_name}</strong>
                      {record.chinese_name ? <em>{record.chinese_name}</em> : null}
                    </span>
                    <span className="detail-search-result-meta">
                      {record.top_category || strings.detail.fallbackCategory}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
        <section className="detail-hero">
          <div className="detail-copy">
            <p className="eyebrow">{item.top_category || strings.detail.fallbackCategory} {item.web_group ? `· ${item.web_group}` : ""}</p>
            <h1>{item.display_name || item.canonical_name}</h1>
            {item.chinese_name ? <p className="detail-chinese">{item.chinese_name}</p> : null}
            <p className="detail-scientific">{item.scientific_name || item.canonical_name}</p>
            <div className="detail-hero-actions">
              <FavoriteToggleButton
                active={isFavorite}
                onClick={() => onToggleFavorite(item.id)}
                strings={strings}
                className="favorite-toggle-inline"
              />
            </div>
            <div className="detail-description-merged">
              <p className="detail-description">
                {description || strings.detail.noDescription}
              </p>
              {detailTraits.length ? (
                <div className="detail-fact-row">
                  {detailTraits.map((fact) => (
                    <span key={fact} className="detail-fact-chip">{fact}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="tag-row">
              {(item.book_groups || []).map((group) => (
                <span key={group} className="tag-chip">{group}</span>
              ))}
              {(item.color_groups || []).map((group) => (
                <span key={group} className="tag-chip subtle">{group}</span>
              ))}
            </div>
          </div>
          <div className="detail-cover">
            {cover ? (
              <button
                type="button"
                className="image-preview-trigger image-preview-trigger-cover"
                onClick={() => openPreview(cover)}
                aria-label={`${strings.common.imagePreviewHint}: ${item.display_name}`}
              >
                <img src={coverSrc} alt={item.display_name} />
                <span className="image-preview-hint">{strings.common.imagePreviewHint}</span>
              </button>
            ) : (
              <div className="image-fallback large">{strings.common.noImage}</div>
            )}
          </div>
        </section>

        <section className="detail-grid">
          <article className="detail-card">
            <h2>{strings.detail.basicInfo}</h2>
            <DefinitionList
              items={[
                ["ID", item.id],
                [strings.detail.standardName, item.canonical_name],
                [strings.detail.chineseName, item.chinese_name || "—"],
                [strings.detail.japaneseName, item.japanese_name || "—"],
                [strings.detail.chineseAliases, chineseAliases.join("、") || "—"],
                [strings.detail.species, item.species || "—"],
                [strings.detail.topCategory, item.top_category || "—"],
                [strings.detail.webGroup, item.web_group || "—"],
                [strings.detail.size, sizeSummary || "—"],
                [strings.detail.imageCount, galleryImages.length],
              ]}
            />
          </article>
        </section>

        {DEV_EDITOR_ENABLED ? (
          <section className="section-block dev-editor-section">
            <div className="section-head">
              <div>
                <h2>{devEditorText.title}</h2>
                <p>{devEditorText.subtitle}</p>
              </div>
              <div className="dev-editor-toolbar">
                <button
                  type="button"
                  className="detail-toggle"
                  onClick={handleEditorToggle}
                >
                  {editorOpen ? devEditorText.close : devEditorText.open}
                </button>
                {editorOpen ? (
                  <button
                    type="button"
                    className="detail-toggle"
                    onClick={handleEditorReset}
                    disabled={!editorBaseRecord || editorState === "saving"}
                  >
                    {devEditorText.reset}
                  </button>
                ) : null}
                {editorOpen ? (
                  <button
                    type="button"
                    className="load-more-button dev-editor-save"
                    onClick={handleEditorSave}
                    disabled={!editorBaseRecord || editorState === "loading" || editorState === "saving"}
                  >
                    {editorState === "saving" ? devEditorText.saving : devEditorText.save}
                  </button>
                ) : null}
              </div>
            </div>

            {!editorOpen ? (
              <p className="detail-note">{devEditorText.closedHint}</p>
            ) : null}
            {editorOpen && editorState === "loading" ? (
              <p className="detail-note">{devEditorText.loading}</p>
            ) : null}
            {editorOpen && editorState !== "loading" ? (
              <>
                <p className="detail-note">{devEditorText.note}</p>
                {editorMessage ? (
                  <p className={`dev-editor-status ${editorState === "error" ? "error" : "success"}`}>
                    {editorMessage}
                  </p>
                ) : null}
                <label className="field dev-editor-field">
                  <span>{devEditorText.jsonLabel}</span>
                  <textarea
                    value={editorDraft}
                    onChange={(event) => setEditorDraft(event.target.value)}
                    rows={24}
                    spellCheck="false"
                  />
                </label>
              </>
            ) : null}

            <div className="dev-editor-upload">
              <label className="field">
                <span>{devEditorText.uploadImages}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  disabled={uploadState === "uploading"}
                />
              </label>
              <label className="dev-editor-upload-option">
                <input
                  type="checkbox"
                  checked={compressUploads}
                  onChange={(event) => setCompressUploads(event.target.checked)}
                  disabled={uploadState === "uploading"}
                />
                <span>{devEditorText.compressUploads}</span>
              </label>
              {uploadMessage ? (
                <p className={`dev-editor-status ${uploadState === "error" ? "error" : "success"}`}>
                  {uploadMessage}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="section-block">
          <div className="section-head">
            <h2>{strings.detail.gallery}</h2>
            <p>{strings.detail.galleryNote}</p>
          </div>
        <div className="gallery-grid">
          {galleryImages.length ? (
            visibleGalleryImages.map((imagePath, index) => (
              <figure
                key={imagePath}
                className={index === 0 ? "gallery-card gallery-card-featured" : "gallery-card"}
              >
                  <button
                    type="button"
                    className="image-preview-trigger"
                    onClick={() => openPreview(imagePath)}
                    aria-label={`${strings.common.imagePreviewHint}: ${item.display_name} ${index + 1}`}
                  >
                    <img
                      src={resolveThumbnailUrl(imagePath, thumbnailManifest, index === 0 ? 960 : 480)}
                      alt={item.display_name}
                      loading="lazy"
                    />
                    <span className="image-preview-hint">{strings.common.imagePreviewHint}</span>
                  </button>
                  {DEV_EDITOR_ENABLED ? (
                    <div className="image-action-group">
                      <button
                        type="button"
                        className={`cover-select-button ${imagePath === cover ? "active" : ""}`.trim()}
                        onClick={() => handleSetPrimaryCover(imagePath)}
                        disabled={coverSavePath === imagePath || Boolean(imageActionPath)}
                        aria-pressed={imagePath === cover}
                      >
                        {imagePath === cover ? strings.common.coverSelected : strings.common.setAsCover}
                      </button>
                      <button
                        type="button"
                        className="image-action-button hide"
                        onClick={() => handleImageAction(imagePath, "hide")}
                        disabled={Boolean(imageActionPath)}
                      >
                        {imageActionPath === `hide:${imagePath}` ? "..." : strings.common.hideImage}
                      </button>
                      <button
                        type="button"
                        className="image-action-button delete"
                        onClick={() => handleImageAction(imagePath, "delete")}
                        disabled={Boolean(imageActionPath)}
                      >
                        {imageActionPath === `delete:${imagePath}` ? "..." : strings.common.deleteImage}
                      </button>
                    </div>
                  ) : null}
                </figure>
              ))
            ) : (
              <div className="empty-state compact">{strings.detail.noImages}</div>
            )}
          </div>
          {galleryImages.length > DETAIL_GALLERY_PAGE_SIZE ? (
            <div className="catalog-actions">
              <p className="catalog-progress">
                {strings.detail.imageProgress(visibleGalleryImages.length, galleryImages.length)}
              </p>
              {hasMoreGalleryImages ? (
                <button
                  type="button"
                  className="load-more-button"
                  onClick={() => setVisibleImageCount((count) => count + DETAIL_GALLERY_PAGE_SIZE)}
                >
                  {strings.common.loadMoreImages}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      {previewIndex != null ? (
        <ImageLightbox
          images={previewImages}
          activeIndex={previewIndex}
          title={item.display_name || item.canonical_name}
          subtitle={item.chinese_name}
          onClose={() => setPreviewIndex(null)}
          onStep={stepPreview}
          strings={strings}
        />
      ) : null}
    </>
  );
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [thumbnailManifest, setThumbnailManifest] = useState({});
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [locale, setLocale] = useState("zh");
  const [favoriteIds, setFavoriteIds] = useState(() => readFavoriteIds());
  const [showDiscoveryCultivars, setShowDiscoveryCultivars] = useState(() => readDiscoveryVisibility());
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  useEffect(() => {
    writeFavoriteIds(favoriteIds);
  }, [favoriteIds]);

  useEffect(() => {
    writeDiscoveryVisibility(showDiscoveryCultivars);
  }, [showDiscoveryCultivars]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === FAVORITES_STORAGE_KEY) {
        setFavoriteIds(readFavoriteIds());
        return;
      }

      if (event.key === DISCOVERY_VISIBILITY_STORAGE_KEY) {
        setShowDiscoveryCultivars(readDiscoveryVisibility());
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function toggleFavorite(id) {
    setFavoriteIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [id, ...current]
    ));
  }

  useEffect(() => {
    Promise.all([loadCatalog(), loadThumbnailManifest()])
      .then(([data, manifest]) => {
        setRecords(data);
        setThumbnailManifest(manifest);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return <div className="app-shell"><div className="empty-state">{UI_STRINGS[locale].app.loading}</div></div>;
  }

  if (status === "error") {
    return <div className="app-shell"><div className="empty-state">{UI_STRINGS[locale].app.loadFailed(error)}</div></div>;
  }

  const strings = UI_STRINGS[locale] || UI_STRINGS.zh;
  const visibleRecords = showDiscoveryCultivars
    ? records
    : records.filter((record) => !isDiscoveryHiddenRecord(record));
  const recordMap = new Map(visibleRecords.map((record) => [record.id, record]));
  const favoriteRecords = favoriteIds.map((id) => recordMap.get(id)).filter(Boolean);

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">Maple Atlas</Link>
        <div className="header-tools">
          <nav className="site-nav">
            <NavLink to="/" end>{strings.nav.popular}</NavLink>
            <NavLink to="/catalog">{strings.nav.catalog}</NavLink>
            <NavLink to="/rhs-awards">{strings.nav.awards}</NavLink>
            <NavLink to="/favorites">{strings.nav.favorites}</NavLink>
          </nav>
          <label className="discovery-switch">
            <input
              type="checkbox"
              checked={showDiscoveryCultivars}
              onChange={(event) => setShowDiscoveryCultivars(event.target.checked)}
            />
            <span>{strings.common.discoveryToggle}</span>
          </label>
          <div className="locale-switch" role="group" aria-label={locale === "en" ? "Language Switch" : "语言切换"}>
            <button
              type="button"
              className={locale === "zh" ? "active" : ""}
              onClick={() => setLocale("zh")}
            >
              {UI_STRINGS.zh.localeName}
            </button>
            <button
              type="button"
              className={locale === "en" ? "active" : ""}
              onClick={() => setLocale("en")}
            >
              {UI_STRINGS.en.localeName}
            </button>
          </div>
        </div>
      </header>

      <Routes>
        <Route
          path="/"
          element={(
            <PopularPage
              records={visibleRecords}
              strings={strings}
              locale={locale}
              favoriteSet={favoriteSet}
              onToggleFavorite={toggleFavorite}
              thumbnailManifest={thumbnailManifest}
            />
          )}
        />
        <Route
          path="/catalog"
          element={(
            <HomePage
              records={visibleRecords}
              strings={strings}
              locale={locale}
              favoriteSet={favoriteSet}
              onToggleFavorite={toggleFavorite}
              thumbnailManifest={thumbnailManifest}
            />
          )}
        />
        <Route path="/search" element={<LegacySearchRedirect />} />
        <Route
          path="/rhs-awards"
          element={(
            <RHSAwardPage
              records={visibleRecords}
              strings={strings}
              locale={locale}
              favoriteSet={favoriteSet}
              onToggleFavorite={toggleFavorite}
              thumbnailManifest={thumbnailManifest}
            />
          )}
        />
        <Route
          path="/favorites"
          element={(
            <FavoritesPage
              records={favoriteRecords}
              strings={strings}
              locale={locale}
              onToggleFavorite={toggleFavorite}
              thumbnailManifest={thumbnailManifest}
            />
          )}
        />
        <Route
          path="/cultivar/:id"
          element={(
            <DetailPage
              records={visibleRecords}
              locale={locale}
              strings={strings}
              favoriteSet={favoriteSet}
              onToggleFavorite={toggleFavorite}
              thumbnailManifest={thumbnailManifest}
            />
          )}
        />
      </Routes>
    </div>
  );
}
