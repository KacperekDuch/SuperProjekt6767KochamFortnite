const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json"
};

function json(data) {
  return new Response(JSON.stringify(data), { headers: corsHeaders });
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function normalize(data, site) {
  return {
    id: String(data.id),
    image: data.image,
    type: data.type || "image",
    site: site,
    tags: data.tags || "",
    title: data.title || "",
    postUrl: data.postUrl || ""
  };
}

// Mapa (registry) providerów bez instrukcji switch i bez łańcucha if/else
const providers = {
  rule34: async function(params, env) {
    const { tags = "", exclude = "", maxPage = 50 } = params;
    const page = Math.floor(Math.random() * Number(maxPage)) + 1;
    const excludeTags = exclude.split(/\s+/).filter(Boolean).map(tag => "-" + tag);
    if (!excludeTags.includes("-ai_generated")) excludeTags.push("-ai_generated");
    const finalTags = `${tags} ${excludeTags.join(" ")}`.trim();
    
    const api = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=100&pid=${page - 1}&tags=${encodeURIComponent(finalTags.replace(/\s+/g, " "))}&user_id=${env.R34_USER_ID || ""}&api_key=${env.R34_API_KEY || ""}`;
    const response = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0 MediaBrowserApp/1.0" } });
    if (!response.ok) return [];
    
    const data = await response.json();
    const posts = Array.isArray(data) ? data : (data.post || []);
    return posts.map(entry => {
      const fileUrl = entry.file_url || entry.sample_url || entry.preview_url;
      if (!fileUrl) return null;
      const file = fileUrl.toLowerCase();
      const type = file.endsWith(".mp4") || file.endsWith(".webm") || file.endsWith(".mov") ? "video" : "image";
      return normalize({ id: entry.id, image: fileUrl, type, tags: entry.tags || "", postUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${entry.id}` }, "rule34");
    }).filter(Boolean);
  },

  safebooru: async function(params, env) {
    const { tags = "", exclude = "", maxPage = 50 } = params;
    const page = Math.floor(Math.random() * Number(maxPage)) + 1;
    const excludeTags = exclude.split(/\s+/).filter(Boolean).map(tag => "-" + tag);
    if (!excludeTags.includes("-ai_generated")) excludeTags.push("-ai_generated");
    const finalTags = `${tags} ${excludeTags.join(" ")}`.trim();
    
    const api = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=100&pid=${page - 1}&tags=${encodeURIComponent(finalTags.replace(/\s+/g, " "))}`;
    const response = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0 MediaBrowserApp/1.0" } });
    if (!response.ok) return [];
    
    const data = await response.json();
    const posts = Array.isArray(data) ? data : (data.post || []);
    return posts.map(entry => {
      const fileUrl = entry.file_url || entry.sample_url || entry.preview_url;
      if (!fileUrl) return null;
      const file = fileUrl.toLowerCase();
      const type = file.endsWith(".mp4") || file.endsWith(".webm") ? "video" : "image";
      return normalize({ id: entry.id, image: fileUrl, type, tags: entry.tags || "", postUrl: `https://safebooru.org/index.php?page=post&s=view&id=${entry.id}` }, "safebooru");
    }).filter(Boolean);
  },

  konachan: async function(params, env) {
    const { tags = "", exclude = "", maxPage = 50 } = params;
    const page = Math.floor(Math.random() * Number(maxPage)) + 1;
    const excludeTags = exclude.split(/\s+/).filter(Boolean).map(tag => "-" + tag);
    if (!excludeTags.includes("-ai_generated")) excludeTags.push("-ai_generated");
    const finalTags = `${tags} ${excludeTags.join(" ")}`.trim();
    
    const api = `https://konachan.com/post.json?limit=100&page=${page}&tags=${encodeURIComponent(finalTags.replace(/\s+/g, " "))}`;
    const response = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0 MediaBrowserApp/1.0" } });
    if (!response.ok) return [];
    
    const data = await response.json();
    const posts = Array.isArray(data) ? data : [];
    return posts.map(entry => {
      let fileUrl = entry.file_url || entry.sample_url;
      if (!fileUrl) return null;
      if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl;
      const file = fileUrl.toLowerCase();
      const type = file.endsWith(".mp4") || file.endsWith(".webm") ? "video" : "image";
      return normalize({ id: entry.id, image: fileUrl, type, tags: entry.tags || "", postUrl: `https://konachan.com/post/show/${entry.id}` }, "konachan");
    }).filter(Boolean);
  },

  wallhaven: async function(params, env) {
    const { tags = "", q = "", maxPage = 50 } = params;
    const page = Math.floor(Math.random() * Number(maxPage)) + 1;
    const wallhavenQuery = q || tags;
    const queryParam = wallhavenQuery ? `&q=${encodeURIComponent(wallhavenQuery)}` : "";
    
    const api = `https://wallhaven.cc/api/v1/search?page=${page}${queryParam}`;
    const response = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0 MediaBrowserApp/1.0" } });
    if (!response.ok) return [];
    
    const data = await response.json();
    const posts = Array.isArray(data.data) ? data.data : [];
    return posts.map(entry => {
      if (!entry.path) return null;
      const tagString = Array.isArray(entry.tags) ? entry.tags.map(t => t.name).join(" ") : "";
      return normalize({ id: entry.id, image: entry.path, type: "image", tags: tagString, postUrl: entry.url || `https://wallhaven.cc/w/${entry.id}` }, "wallhaven");
    }).filter(Boolean);
  },

  pixabay: async function(params, env) {
    const { q = "", maxPage = 50 } = params;
    const page = Math.floor(Math.random() * Number(maxPage)) + 1;
    const query = q || "wallpaper";
    
    const api = `https://pixabay.com/api/?key=${env.PIXABAY_API || ""}&q=${encodeURIComponent(query)}&image_type=photo&per_page=50&page=${page}`;
    const response = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0 MediaBrowserApp/1.0" } });
    if (!response.ok) return [];
    
    const data = await response.json();
    const posts = Array.isArray(data.hits) ? data.hits : [];
    return posts.map(entry => {
      const imageUrl = entry.largeImageURL || entry.webformatURL;
      if (!imageUrl) return null;
      return normalize({ id: entry.id, image: imageUrl, type: "image", tags: entry.tags || "", postUrl: entry.pageURL || "" }, "pixabay");
    }).filter(Boolean);
  },

  pexels: async function(params, env) {
    const { q = "", maxPage = 50 } = params;
    const page = Math.floor(Math.random() * Number(maxPage)) + 1;
    const query = q || "wallpaper";
    
    const api = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=30&page=${page}`;
    const response = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0 MediaBrowserApp/1.0", "Authorization": env.PEXEL_API || "" } });
    if (!response.ok) return [];
    
    const data = await response.json();
    const posts = Array.isArray(data.photos) ? data.photos : [];
    return posts.map(entry => {
      const imageUrl = entry.src?.large2x || entry.src?.original;
      if (!imageUrl) return null;
      return normalize({ id: entry.id, image: imageUrl, type: "image", tags: "", postUrl: entry.url || "" }, "pexels");
    }).filter(Boolean);
  },

  cats: async function(params, env) {
    const api = `https://api.thecatapi.com/v1/images/search?limit=10`;
    const response = await fetch(api, { headers: { "User-Agent": "Mozilla/5.0 MediaBrowserApp/1.0" } });
    if (!response.ok) return [];
    
    const data = await response.json();
    const posts = Array.isArray(data) ? data : [];
    return posts.map(entry => {
      if (!entry.url) return null;
      return normalize({ id: entry.id, image: entry.url, type: "image", tags: "cat", postUrl: entry.url }, "cats");
    }).filter(Boolean);
  }
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const siteParam = url.searchParams.get("site") || "wallhaven";
    const tags = (url.searchParams.get("tags") || "").trim();
    const query = (url.searchParams.get("q") || "").trim();
    const exclude = (url.searchParams.get("exclude") || "").trim();
    const maxPage = Number(url.searchParams.get("maxPage")) || 50;
    const tries = Number(url.searchParams.get("tries")) || 10;
    const amount = Math.min(Math.max(Number(url.searchParams.get("amount")) || 1, 1), 100);

    const siteList = siteParam.includes(",") 
      ? siteParam.split(",").map(s => s.trim()).filter(Boolean) 
      : [siteParam];

    const activeProviders = siteList.map(name => providers[name]).filter(Boolean);
    if (activeProviders.length === 0) {
      return json({ success: false, error: "No valid providers selected." });
    }

    const params = { tags, q: query, exclude, maxPage, tries, amount };

    try {
      let collectedItems = [];

      // Mechanizm pętli prób (tries) oraz dynamicznego dociągania do żądanego amount
      for (let attempt = 0; attempt < tries; attempt++) {
        if (collectedItems.length >= amount) break;

        const promises = activeProviders.map(async (providerFunc) => {
          try {
            const results = await providerFunc(params, env);
            return Array.isArray(results) ? results : [];
          } catch (e) {
            console.error("Provider fetch error:", e);
            return [];
          }
        });

        const resultsArray = await Promise.all(promises);
        resultsArray.forEach(list => {
          collectedItems = collectedItems.concat(list);
        });

        // Bezpieczna deduplikacja oparta na unikalnym kluczu provider + id lub image url
        const uniqueMap = new Map();
        collectedItems.forEach(item => {
          const key = `${item.site}-${item.id}` || item.image;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });
        collectedItems = Array.from(uniqueMap.values());
      }

      const shuffledItems = shuffle(collectedItems).slice(0, amount);

      if (shuffledItems.length > 0) {
        return json({ success: true, items: shuffledItems });
      }

      return json({ success: false, error: "Nothing found." });
    } catch (e) {
      console.error("Worker Error:", e);
      return json({ success: false, error: e.message || "Internal Error" });
    }
  }
};