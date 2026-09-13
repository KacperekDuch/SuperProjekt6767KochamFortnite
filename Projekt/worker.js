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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const site = url.searchParams.get("site") || "wallhaven";
    const tags = (url.searchParams.get("tags") || "").trim();
    const query = (url.searchParams.get("q") || "").trim();
    const exclude = (url.searchParams.get("exclude") || "").trim();

    const maxPage = Number(url.searchParams.get("maxPage")) || 50;
    const tries = Number(url.searchParams.get("tries")) || 10;
    const amount = Math.min(Math.max(Number(url.searchParams.get("amount")) || 1, 1), 100);

    const excludeTags = exclude.split(/\s+/).filter(Boolean).map(tag => "-" + tag);

    // ZAWSZE NA TWARDO DODAJEMY -ai_generated (poza Wallhaven)
    if (site !== "wallhaven" && !excludeTags.includes("-ai_generated")) {
      excludeTags.push("-ai_generated");
    }
    
    const finalTags = `${tags} ${excludeTags.join(" ")}`.trim();

    const pagesToFetchCount = Math.min(Math.ceil(amount / 5) + 1, tries, maxPage);
    const pages = new Set();
    while (pages.size < pagesToFetchCount) {
      pages.add(Math.floor(Math.random() * maxPage) + 1);
    }

    let allMediaItems = [];

    const fetchPage = async (page) => {
      let api = "";
      let fetchOptions = {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MediaBrowserApp/1.0"
        }
      };

      // -=-=-= NOWE SWITCH =-=-=- //
      switch (site) {
        case "rule34":
          api = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=100&pid=${page - 1}&tags=${encodeURIComponent(finalTags.replace(/\s+/g, " "))}&user_id=${env.R34_USER_ID || ""}&api_key=${env.R34_API_KEY || ""}`;
          break;

        case "safebooru":
          api = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=100&pid=${page - 1}&tags=${encodeURIComponent(finalTags.replace(/\s+/g, " "))}`;
          break;

        case "konachan":
          api = `https://konachan.com/post.json?limit=100&page=${page}&tags=${encodeURIComponent(finalTags.replace(/\s+/g, " "))}`;
          break;

        case "wallhaven":
          const wallhavenQuery = query || finalTags;
          const queryParam = wallhavenQuery ? `&q=${encodeURIComponent(wallhavenQuery)}` : "";
          api = `https://wallhaven.cc/api/v1/search?page=${page}${queryParam}`;
          break;

        case "pixabay":
          api = `https://pixabay.com/api/?key=${env.PIXABAY_API || ""}&q=${encodeURIComponent(query || "wallpaper")}&image_type=photo&per_page=50&page=${page}`;
          break;

        case "pexels":
          api = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query || "wallpaper")}&per_page=30&page=${page}`;
          fetchOptions.headers["Authorization"] = env.PEXEL_API || "";
          break;

        case "cats":
          api = `https://api.thecatapi.com/v1/images/search?limit=10`;
          break;

        default:
          return [];
      }

      try {
        let items = [];
        const response = await fetch(api, fetchOptions);
        if (!response.ok) return [];

        const data = await response.json();

        // -=-=-= NOWE ELSE IF =-=-=- //
        if (site === "rule34" || site === "safebooru") {
          const posts = Array.isArray(data) ? data : (data.post || []);
          posts.forEach(entry => {
            const fileUrl = entry.file_url || entry.sample_url || entry.preview_url;
            if (fileUrl) {
              const file = fileUrl.toLowerCase();
              items.push({
                image: fileUrl,
                type: file.endsWith(".mp4") || file.endsWith(".webm") || file.endsWith(".mov") ? "video" : "image",
                id: String(entry.id),
                site,
                tags: entry.tags || ""
              });
            }
          });
        } else if (site === "konachan") {
          const posts = Array.isArray(data) ? data : [];
          posts.forEach(entry => {
            let fileUrl = entry.file_url || entry.sample_url;
            if (fileUrl) {
              if (fileUrl.startsWith("//")) fileUrl = "https:" + fileUrl;
              const file = fileUrl.toLowerCase();
              items.push({
                image: fileUrl,
                type: file.endsWith(".mp4") || file.endsWith(".webm") ? "video" : "image",
                id: String(entry.id),
                site,
                tags: entry.tags || ""
              });
            }
          });
        } else if (site === "pixabay" && data.hits) {
          data.hits.forEach(entry => {
            items.push({
              image: entry.largeImageURL || entry.webformatURL,
              type: "image",
              id: String(entry.id),
              site,
              tags: entry.tags || ""
            });
          });
        } else if (site === "wallhaven" && Array.isArray(data.data)) {
          data.data.forEach(entry => {
            if (entry.path) {
              let tagString = Array.isArray(entry.tags) ? entry.tags.map(t => t.name).join(" ") : "";
              items.push({
                image: entry.path,
                type: "image",
                id: String(entry.id),
                site,
                tags: tagString
              });
            }
          });
        } else if (site === "pexels" && data.photos) {
          data.photos.forEach(entry => {
            items.push({
              image: entry.src.large2x || entry.src.original,
              type: "image",
              id: String(entry.id),
              site,
              tags: ""
            });
          });
        } else if (site === "cats" && Array.isArray(data)) {
          data.forEach(entry => {
            items.push({
              image: entry.url,
              type: "image",
              id: String(entry.id),
              site,
              tags: ""
            });
          });
        }

        return items;
      } catch (e) {
        return [];
      }
    };

    const resultsArray = await Promise.all([...pages].map(page => fetchPage(page)));
    resultsArray.forEach(list => { allMediaItems = allMediaItems.concat(list); });

    const uniqueMediaMap = new Map();
    allMediaItems.forEach(item => {
      if (item && item.id && !uniqueMediaMap.has(item.id)) {
        uniqueMediaMap.set(item.id, item);
      } else if (item && item.image && !uniqueMediaMap.has(item.image)) {
        uniqueMediaMap.set(item.image, item);
      }
    });

    const uniqueMediaArray = Array.from(uniqueMediaMap.values());
    const shuffledResults = shuffle(uniqueMediaArray).slice(0, amount);

    if (shuffledResults.length > 0) {
      return json({ success: true, items: shuffledResults });
    }

    return json({ success: false, error: "Nothing found." });
  }
};