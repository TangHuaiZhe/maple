import { useDeferredValue, useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

function hasContent(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function mergeLocalizedValue(baseValue, localizedValue) {
  if (!hasContent(localizedValue)) {
    return baseValue;
  }

  if (
    baseValue &&
    localizedValue &&
    typeof baseValue === "object" &&
    typeof localizedValue === "object" &&
    !Array.isArray(baseValue) &&
    !Array.isArray(localizedValue)
  ) {
    const merged = { ...baseValue };

    Object.entries(localizedValue).forEach(([key, value]) => {
      merged[key] = mergeLocalizedValue(baseValue[key], value);
    });

    return merged;
  }

  return localizedValue;
}

function localizeRecord(record) {
  return {
    ...record,
    descriptions: mergeLocalizedValue(record.descriptions, record.descriptions_zh),
    rhs: mergeLocalizedValue(record.rhs, record.rhs_zh),
  };
}

function cleanMrMapleDescription(text) {
  if (!hasContent(text)) return "";

  return text
    .replace(/\*\*/g, "")
    .split(/Limited Quantities Available|Please note that your \d+-gallon tree/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

function getPreferredDescription(item) {
  const candidates = [
    item.descriptions?.preferred,
    item.rhs?.description,
    ...((item.mrmaple?.products || []).map((product) => cleanMrMapleDescription(product.description_text))),
    ...((item.sources || []).map((source) => source.description)),
  ];

  return candidates.find(hasContent) || "";
}

function loadMaples() {
  return fetch("/data/merged-cultivars.json").then((response) => {
    if (!response.ok) {
      throw new Error("无法加载 merged-cultivars.json");
    }
    return response.json().then((records) => records.map(localizeRecord));
  });
}

function summarizeText(text, limit = 140) {
  if (!text) return "暂无简介";
  return text.length <= limit ? text : `${text.slice(0, limit).trim()}...`;
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

function Stats({ records }) {
  const both = records.filter((item) => item.has_book && item.has_web).length;
  const images = records.reduce((sum, item) => sum + (item.images.public_count || item.images.count || 0), 0);

  return (
    <div className="stats-grid">
      <article className="stat-card">
        <span>总条目</span>
        <strong>{records.length}</strong>
      </article>
      <article className="stat-card">
        <span>分类数</span>
        <strong>{new Set(records.map((item) => item.top_category).filter(Boolean)).size}</strong>
      </article>
      <article className="stat-card">
        <span>双来源</span>
        <strong>{both}</strong>
      </article>
      <article className="stat-card">
        <span>图片总数</span>
        <strong>{images}</strong>
      </article>
    </div>
  );
}

function CategoryCard({ category, count, cover }) {
  return (
    <article className="category-card">
      <div className="category-cover">
        {cover ? <img src={cover} alt={category} /> : <div className="image-fallback">{category}</div>}
      </div>
      <div className="category-copy">
        <h3>{category}</h3>
        <p>{count} 个条目</p>
      </div>
    </article>
  );
}

function CultivarCard({ item }) {
  const description = getPreferredDescription(item);

  return (
    <article className="cultivar-card">
      <div className="cultivar-thumb">
        {item.images.public_cover_path ? (
          <img src={item.images.public_cover_path} alt={item.display_name} loading="lazy" />
        ) : (
          <div className="image-fallback">No Image</div>
        )}
      </div>
      <div className="cultivar-meta">
        <div className="cultivar-kicker">
          <span>{item.top_category || "书籍条目"}</span>
          {item.web_group ? <span>{item.web_group}</span> : null}
        </div>
        <h3>
          <Link to={`/cultivar/${item.id}`}>{item.display_name || item.canonical_name}</Link>
        </h3>
        <p>{item.scientific_name || item.canonical_name}</p>
        <p>{summarizeText(description)}</p>
      </div>
    </article>
  );
}

function HomePage({ records }) {
  const categories = [...records.reduce((map, item) => {
    if (!item.top_category) {
      return map;
    }
    const current = map.get(item.top_category) || { count: 0, cover: null };
    current.count += 1;
    if (!current.cover && item.images.public_cover_path) {
      current.cover = item.images.public_cover_path;
    }
    map.set(item.top_category, current);
    return map;
  }, new Map()).entries()]
    .sort((a, b) => b[1].count - a[1].count);

  const featured = records
    .filter((item) => item.images.public_cover_path)
    .sort((a, b) => (b.images.public_count || 0) - (a.images.public_count || 0))
    .slice(0, 6);

  return (
    <div className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Japanese Maple Atlas</p>
          <h1>把合并后的日本枫树资料，先跑成可浏览的应用骨架。</h1>
          <p>
            当前直接消费 `merged-cultivars.json`，先解决分类浏览、搜索和详情展示，后续再叠加收藏、
            对比和离线缓存。
          </p>
          <div className="hero-actions">
            <Link className="button-primary" to="/search">
              开始搜索
            </Link>
            <a className="button-secondary" href="/data/merged-cultivars.json" target="_blank" rel="noreferrer">
              查看 JSON
            </a>
          </div>
        </div>
        <Stats records={records} />
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2>分类页</h2>
          <p>按一级分类快速进入资料池，适合先看全貌。</p>
        </div>
        <div className="category-grid">
          {categories.map(([name, meta]) => (
            <CategoryCard key={name} category={name} count={meta.count} cover={meta.cover} />
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-head">
          <h2>带图条目</h2>
          <p>优先展示本地图片素材更完整的条目。</p>
        </div>
        <div className="cultivar-grid">
          {featured.map((item) => (
            <CultivarCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchPage({ records }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialQuery = new URLSearchParams(location.search).get("q") || "";
  const initialCategory = new URLSearchParams(location.search).get("category") || "全部";
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== "全部") params.set("category", category);
    navigate({ pathname: "/search", search: params.toString() }, { replace: true });
  }, [query, category, navigate]);

  const categories = ["全部", ...new Set(records.map((item) => item.top_category).filter(Boolean))];
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filtered = records.filter((item) => {
    const categoryMatch = category === "全部" || item.top_category === category;
    if (!categoryMatch) return false;
    if (!normalizedQuery) return true;
    return [item.display_name, item.canonical_name, item.scientific_name, ...item.aliases, ...item.search_terms]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  return (
    <div className="page-shell">
      <section className="search-panel">
        <div className="section-head">
          <h1>搜索页</h1>
          <p>按名称、学名、别名和分类词项检索。</p>
        </div>
        <div className="search-controls">
          <label className="field">
            <span>关键词</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如 Akane、茜、羽毛枫" />
          </label>
          <label className="field">
            <span>一级分类</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="result-summary">结果：{filtered.length} 条</div>
      </section>

      <section className="cultivar-grid">
        {filtered.slice(0, 120).map((item) => (
          <CultivarCard key={item.id} item={item} />
        ))}
      </section>
    </div>
  );
}

function DetailPage({ records }) {
  const { id } = useParams();
  const item = records.find((record) => record.id === id);
  const description = item ? getPreferredDescription(item) : "";

  if (!item) {
    return (
      <div className="page-shell">
        <div className="empty-state">
          <h1>未找到条目</h1>
          <p>该详情页 ID 不存在于当前数据集中。</p>
        </div>
      </div>
    );
  }

  const rhs = item.rhs;
  const rhsDimensionItems = rhs
    ? [
        ["RHS 学名", rhs.botanical_name],
        ["成年高度", rhs.dimensions?.height],
        ["冠幅", rhs.dimensions?.spread],
        ["达到成年尺寸", rhs.dimensions?.time_to_full_height],
        ["耐寒性", rhs.growing_conditions?.hardiness],
        ["光照", rhs.growing_conditions?.sunlight],
        ["土壤", rhs.growing_conditions?.soil_type],
        ["朝向", rhs.growing_conditions?.aspect],
        ["水分", rhs.growing_conditions?.moisture],
        ["酸碱度", rhs.growing_conditions?.ph],
        ["环境暴露", rhs.growing_conditions?.exposure],
      ]
    : [];
  const rhsCareItems = rhs
    ? [
        ["栽培建议", rhs.care?.cultivation],
        ["修剪", rhs.care?.pruning],
        ["繁殖", rhs.care?.propagation],
        ["虫害风险", rhs.resistance?.pest],
        ["病害风险", rhs.resistance?.disease],
        ["建议用途", rhs.attributes?.suggested_uses],
        ["株型", rhs.attributes?.habit],
        ["植物类型", rhs.attributes?.plant_type],
        ["落叶/常绿", rhs.attributes?.foliage],
      ]
    : [];

  return (
    <div className="page-shell detail-shell">
      <section className="detail-hero">
        <div className="detail-copy">
          <p className="eyebrow">{item.top_category || "书籍条目"} {item.web_group ? `· ${item.web_group}` : ""}</p>
          <h1>{item.display_name || item.canonical_name}</h1>
          <p className="detail-scientific">{item.scientific_name || item.canonical_name}</p>
          <p>{description || "暂无描述"}</p>
          <div className="tag-row">
            {item.book_groups.map((group) => (
              <span key={group} className="tag-chip">{group}</span>
            ))}
            {item.color_groups.map((group) => (
              <span key={group} className="tag-chip subtle">{group}</span>
            ))}
          </div>
        </div>
        <div className="detail-cover">
          {item.images.public_cover_path ? (
            <img src={item.images.public_cover_path} alt={item.display_name} />
          ) : (
            <div className="image-fallback large">No Image</div>
          )}
        </div>
      </section>

      <section className="detail-grid">
        <article className="detail-card">
          <h2>基本信息</h2>
          <DefinitionList
            items={[
              ["ID", item.id],
              ["标准名", item.canonical_name],
              ["中文名", item.chinese_name || "—"],
              ["物种", item.species || "—"],
              ["一级分类", item.top_category || "—"],
              ["网页分组", item.web_group || "—"],
              ["图片数", item.images.public_count || item.images.count || 0],
              ["来源数", item.source_count],
              ["RHS 增强", item.has_rhs ? "已匹配" : "未匹配"],
            ]}
          />
        </article>

        <article className="detail-card">
          <h2>来源</h2>
          <div className="source-stack">
            {item.sources.map((source) => (
              <div key={`${source.source}-${source.name || source.detail_id || source.rhs_id || source.botanical_name}`} className="source-item">
                <strong>{source.source}</strong>
                {source.name ? <p>{source.name}</p> : null}
                {source.botanical_name ? <p>{source.botanical_name}</p> : null}
                {source.page_range ? <p>页码：{source.page_range}</p> : null}
                {source.group ? <p>分组：{source.group}</p> : null}
                {source.detail_url ? <a href={source.detail_url} target="_blank" rel="noreferrer">打开详情页</a> : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      {rhs ? (
        <section className="detail-grid">
          <article className="detail-card">
            <h2>RHS 尺寸与环境</h2>
            <DefinitionList items={rhsDimensionItems} />
          </article>

          <article className="detail-card">
            <h2>RHS 养护与风险</h2>
            <div className="rhs-stack">
              {rhsCareItems.filter(([, value]) => value).map(([label, value]) => (
                <div key={label} className="rhs-item">
                  <strong>{label}</strong>
                  <p>{value}</p>
                </div>
              ))}
            </div>
            <p className="detail-note">
              RHS 数据来自 Royal Horticultural Society 公开植物详情页，用于补充尺寸、种植条件和养护信息。
            </p>
          </article>
        </section>
      ) : null}

      <section className="section-block">
        <div className="section-head">
          <h2>图片画廊</h2>
          <p>优先使用已同步到本地的图片，包含原始资料图片和 RHS 私有归档图片。</p>
        </div>
        <div className="gallery-grid">
          {item.images.public_paths.length ? (
            item.images.public_paths.map((imagePath) => (
              <figure key={imagePath} className="gallery-card">
                <img src={imagePath} alt={item.display_name} loading="lazy" />
              </figure>
            ))
          ) : (
            <div className="empty-state compact">当前条目没有本地图片。</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    loadMaples()
      .then((data) => {
        setRecords(data);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return <div className="app-shell"><div className="empty-state">正在加载日本枫树数据…</div></div>;
  }

  if (status === "error") {
    return <div className="app-shell"><div className="empty-state">加载失败：{error}</div></div>;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">Maple Atlas</Link>
        <nav className="site-nav">
          <NavLink to="/" end>分类页</NavLink>
          <NavLink to="/search">搜索页</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<HomePage records={records} />} />
        <Route path="/search" element={<SearchPage records={records} />} />
        <Route path="/cultivar/:id" element={<DetailPage records={records} />} />
      </Routes>
    </div>
  );
}
