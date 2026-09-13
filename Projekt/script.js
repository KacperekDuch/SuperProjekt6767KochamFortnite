// Adres Cloudflare Workera obsługującego zapytania do API
const WORKER = "https://image.kacperekduch67.workers.dev";

// --- Elementy DOM (UI) ---
const tags = document.getElementById("tags");
const exclude = document.getElementById("exclude");
const searchQuery = document.getElementById("searchQuery");

const maxPage = document.getElementById("maxPage");
const tries = document.getElementById("tries");
const items = document.getElementById("items");
const siteElement = document.getElementById("site");
const presetSelect = document.getElementById("presetSelect");

// Grupy pól input w panelu bocznym
const groupBooru = document.getElementById("group-booru");
const groupWallpapers = document.getElementById("group-wallpapers");
const groupFun = document.getElementById("group-fun");

// Konfiguracja wyglądu (Layout & Themes)
const layoutCategory = document.getElementById("layoutCategory");
const layoutStyle = document.getElementById("layoutStyle");
const tiktokOptionsContainer = document.getElementById("tiktokOptionsContainer");
const tiktokColumns = document.getElementById("tiktokColumns");
const tiktokFitMode = document.getElementById("tiktokFitMode");
const colorThemeSelect = document.getElementById("colorTheme");

// Główny kontener galerii i podglądu
const gallery = document.getElementById("gallery");
const viewer = document.getElementById("viewer");
const randomBtn = document.getElementById("randomBtn");
const toggleBtn = document.getElementById("toggleSidebar");
const sidebar = document.getElementById("sidebar");

// Modal podglądu multimediów
const preview = document.getElementById("preview");
const previewContent = document.getElementById("previewContent");
const previewTags = document.getElementById("previewTags");
const closePreview = document.getElementById("closePreview");
const openPost = document.getElementById("openPost");
const downloadMedia = document.getElementById("downloadMedia");
const copyLink = document.getElementById("copyLink");

// Przyciski kontroli multimediów (wideo / audio)
const muteBtn = document.getElementById("muteBtn");
const pauseBtn = document.getElementById("pauseBtn");
const nativeControlsBtn = document.getElementById("nativeControlsBtn");
const globalVolumeToggle = document.getElementById("globalVolumeToggle");
const volumeSlider = document.getElementById("volumeSlider");

// Ustawienia feedu i auto-ładowania
const appendMode = document.getElementById("appendMode");
const autoFetchInterval = document.getElementById("autoFetchInterval");
const autoLoadBtn = document.getElementById("autoLoadBtn");
const tiktokSmartBtn = document.getElementById("tiktokSmartBtn");
const keyboardListeningToggle = document.getElementById("keyboardListeningToggle");

// --- Stan aplikacji ---
let muted = true;
let paused = true;
let showNativeControls = false;
let autoLoadInterval = null;
let isAutoLoading = false;
let loadedIds = new Set();
let currentMedia = null;

let isSmartSoundActive = false;
let tiktokObserver = null;

// Obsługa zwijania/rozwijania panelu bocznego
toggleBtn.onclick = () => sidebar.classList.toggle("hidden");

// Funkcja przełączająca widoczność grup pól wejściowych w zależności od wybranego API
function updateApiInputGroups() {
    const selectedOption = siteElement.options[siteElement.selectedIndex];
    const group = selectedOption.getAttribute("data-group") || "booru";

    if (groupBooru) groupBooru.style.display = "none";
    if (groupWallpapers) groupWallpapers.style.display = "none";
    if (groupFun) groupFun.style.display = "none";

    if (group === "booru" && groupBooru) {
        groupBooru.style.display = "flex";
    } else if (group === "wallpapers" && groupWallpapers) {
        groupWallpapers.style.display = "flex";
    } else if (group === "fun" && groupFun) {
        groupFun.style.display = "flex";
    }
}

siteElement.onchange = updateApiInputGroups;
updateApiInputGroups();

// --- Baza danych tagów i autouzupełnianie ---
let globalTagsData = { artist: [], copyright: [], character: [], general: [], meta: [] };

async function loadTagsDatabase() {
    try {
        const response = await fetch("api/tags.json");
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.tags)) {
                globalTagsData.general = data.tags;
            } else {
                globalTagsData = { ...globalTagsData, ...data };
            }
        }
    } catch (e) {
        console.error("Nie udało się załadować bazy tagów:", e);
    }
}

loadTagsDatabase();

function getTagCategoryAndColor(tagName) {
    const cleanTag = tagName.trim().toLowerCase();
    let category = "general";

    for (const [cat, list] of Object.entries(globalTagsData)) {
        if (Array.isArray(list) && list.some(t => t.toLowerCase() === cleanTag)) {
            category = cat;
            break;
        }
    }

    let color = "#3b82f6";
    if (category === "artist") color = "#ef4444";
    else if (category === "copyright") color = "#ec4899";
    else if (category === "character") color = "#10b981";
    else if (category === "meta") color = "#f59e0b";

    return { category, color };
}

// Kontener podpowiedzi tagów
const suggestionsBox = document.createElement("div");
suggestionsBox.id = "tagsSuggestions";
suggestionsBox.style.cssText = `
    position: absolute;
    background: #1e1e1e;
    border: 1px solid #444;
    max-height: 200px;
    overflow-y: auto;
    display: none;
    z-index: 1000;
    border-radius: 4px;
    font-size: 13px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
`;

if (tags && tags.parentNode) {
    tags.parentNode.style.position = "relative";
    tags.parentNode.appendChild(suggestionsBox);
}

if (tags) {
    tags.addEventListener("input", () => {
        const val = tags.value;
        const words = val.split(/\s+/);
        const currentWord = words[words.length - 1].toLowerCase();

        if (currentWord.length < 2) {
            suggestionsBox.style.display = "none";
            return;
        }

        let matches = [];
        for (const [category, tagList] of Object.entries(globalTagsData)) {
            if (Array.isArray(tagList)) {
                tagList.forEach(t => {
                    if (t.toLowerCase().includes(currentWord) && t.toLowerCase() !== currentWord) {
                        matches.push({ tag: t, category: category });
                    }
                });
            }
        }

        matches = matches.slice(0, 15);

        if (matches.length > 0) {
            suggestionsBox.innerHTML = "";
            matches.forEach(m => {
                const div = document.createElement("div");
                div.style.cssText = "padding: 6px 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;";
                
                const { color: catColor } = getTagCategoryAndColor(m.tag);

                div.innerHTML = `<span style="color: #fff;">${m.tag}</span> <span style="font-size: 10px; color: ${catColor}; text-transform: uppercase; margin-left: 10px;">${m.category}</span>`;
                
                div.onmouseover = () => div.style.background = "rgba(255,255,255,0.05)";
                div.onmouseout = () => div.style.background = "transparent";
                
                div.onclick = () => {
                    words[words.length - 1] = m.tag;
                    tags.value = words.join(" ") + " ";
                    suggestionsBox.style.display = "none";
                    tags.focus();
                };

                suggestionsBox.appendChild(div);
            });

            suggestionsBox.style.width = `${tags.offsetWidth}px`;
            suggestionsBox.style.display = "block";
        } else {
            suggestionsBox.style.display = "none";
        }
    });

    document.addEventListener("click", (e) => {
        if (e.target !== tags && e.target !== suggestionsBox) {
            suggestionsBox.style.display = "none";
        }
    });
}

// --- Presety tagów ---
const TAG_PRESETS = {
    safe: {
        tags: "female",
        exclude: "gay furry gore anthro"
    },
    futa: {
        tags: "futanari",
        exclude: "gay furry gore anthro"
    }
};

if (presetSelect) {
    presetSelect.onchange = () => {
        const val = presetSelect.value;
        if (TAG_PRESETS[val]) {
            tags.value = TAG_PRESETS[val].tags;
            exclude.value = TAG_PRESETS[val].exclude;
        }
    };
}

// --- Motywy kolorystyczne ---
const COLOR_THEMES = {
    default: { primary: "#222222", accent: "#4a90ff" },
    cyberpunk: { primary: "#120822", accent: "#f3e600" },
    crimson: { primary: "#1a0505", accent: "#ef4444" },
    emerald: { primary: "#022c22", accent: "#10b981" }
};

if (colorThemeSelect) {
    colorThemeSelect.onchange = () => {
        const theme = COLOR_THEMES[colorThemeSelect.value];
        if (theme) {
            document.documentElement.style.setProperty("--color-primary", theme.primary);
            document.documentElement.style.setProperty("--color-accent", theme.accent);
        }
    };
}

// --- Layouty i style galerii ---
const layoutOptionsMap = {
    moodboard: [
        { value: "pinterest", label: "Pinterest (Masonry)" },
        { value: "flickr", label: "Flickr (Równe rzędy)" }
    ],
    single: [
        { value: "grid", label: "Grid (Siatka)" },
        { value: "single", label: "Single (Pojedynczy ekran)" }
    ],
    tiktok: [
        { value: "tiktok-custom", label: "TikTok Slideshow (Kolumny)" }
    ]
};

function updateSubLayouts() {
    const category = layoutCategory.value;
    layoutStyle.innerHTML = "";
    
    (layoutOptionsMap[category] || []).forEach(opt => {
        const el = document.createElement("option");
        el.value = opt.value;
        el.textContent = opt.label;
        layoutStyle.appendChild(el);
    });

    if (category === "tiktok") {
        tiktokOptionsContainer.style.display = "flex";
    } else {
        tiktokOptionsContainer.style.display = "none";
    }

    applyLayoutChanges();
}

function applyLayoutChanges() {
    gallery.className = "";
    gallery.classList.add(`layout-${layoutStyle.value}`);

    if (layoutCategory.value === "tiktok") {
        gallery.style.setProperty("--tiktok-cols", tiktokColumns.value || 1);
        gallery.style.setProperty("--tiktok-fit", tiktokFitMode.value || "contain");
        initTikTokObserver();
    } else {
        if (tiktokObserver) tiktokObserver.disconnect();
    }
}

layoutCategory.onchange = updateSubLayouts;
layoutStyle.onchange = applyLayoutChanges;
tiktokColumns.oninput = applyLayoutChanges;
tiktokFitMode.onchange = applyLayoutChanges;

updateSubLayouts();

// --- Główna funkcja pobierania danych (Load / Random) ---
randomBtn.onclick = () => load(false);

// Skróty klawiszowe
window.addEventListener("keydown", e => {
    if (keyboardListeningToggle && !keyboardListeningToggle.checked) return;

    const activeEl = document.activeElement;
    const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
    
    if (e.code === "Space") {
        if (!isInput) {
            e.preventDefault();
            if (!randomBtn.disabled) load(true);
        }
    } else if (e.code === "KeyR") {
        if (!isInput) {
            e.preventDefault();
            if (!randomBtn.disabled) load(false);
        }
    } else if (e.code === "KeyM") {
        if (!isInput) muteBtn.click();
    } else if (e.code === "KeyP") {
        if (!isInput) pauseBtn.click();
    } else if (e.code === "Escape") {
        closePreview.click();
    }
});

// Auto-fetch (Automatyczne pobieranie co X sekund)
if (autoLoadBtn) {
    autoLoadBtn.onclick = () => {
        isAutoLoading = !isAutoLoading;
        if (isAutoLoading) {
            const sec = Math.max(1, parseInt(autoFetchInterval ? autoFetchInterval.value : 5) || 5);
            autoLoadBtn.textContent = `⏳ Auto-Fetch (Co ${sec}s): ON`;
            autoLoadBtn.classList.add("active");
            if (appendMode) appendMode.checked = true;
            
            autoLoadInterval = setInterval(() => {
                if (!randomBtn.disabled) load(true);
            }, sec * 1000);
        } else {
            autoLoadBtn.textContent = "⏳ Auto-Fetch: OFF";
            autoLoadBtn.classList.remove("active");
            clearInterval(autoLoadInterval);
        }
    };
}

if (tiktokSmartBtn) {
    tiktokSmartBtn.onclick = () => {
        isSmartSoundActive = !isSmartSoundActive;
        tiktokSmartBtn.textContent = `📱 Smart Sound: ${isSmartSoundActive ? "ON" : "OFF"}`;
        tiktokSmartBtn.classList.toggle("active", isSmartSoundActive);
        initTikTokObserver();
    };
}

function initTikTokObserver() {
    if (tiktokObserver) tiktokObserver.disconnect();
    if (!isSmartSoundActive || layoutCategory.value !== "tiktok") return;

    const options = { root: viewer, threshold: 0.7 };
    tiktokObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector("video");
            if (!video) return;

            if (entry.isIntersecting) {
                video.muted = !globalVolumeToggle.checked;
                video.volume = globalVolumeToggle.checked ? parseFloat(volumeSlider.value) : 0;
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        });
    }, options);

    document.querySelectorAll(".card-video").forEach(card => {
        tiktokObserver.observe(card);
    });
}

viewer.addEventListener("scroll", () => {
    if (layoutCategory.value === "tiktok" && !isAutoLoading) {
        if (viewer.scrollTop + viewer.clientHeight >= viewer.scrollHeight - 100) {
            if (!randomBtn.disabled) {
                load(true);
            }
        }
    }
});

async function load(shouldAppend = false) {
    randomBtn.disabled = true;
    randomBtn.textContent = "Loading...";

    const isAppending = shouldAppend || (appendMode && appendMode.checked);
    if (!isAppending) {
        gallery.innerHTML = "";
        loadedIds.clear();
    }

    const amount = Number(items ? items.value : 1);
    const currentSite = siteElement ? siteElement.value : "rule34";
    const maxPageVal = maxPage ? maxPage.value : "50";
    const triesVal = tries ? tries.value : "10";
    
    const tagsVal = tags ? tags.value : "";
    const excludeVal = exclude ? exclude.value : "";
    const queryVal = searchQuery ? searchQuery.value : "";

    try {
        const response = await fetch(
            `${WORKER}?` +
            `site=${currentSite}` +
            `&tags=${encodeURIComponent(tagsVal)}` +
            `&exclude=${encodeURIComponent(excludeVal)}` +
            `&q=${encodeURIComponent(queryVal)}` +
            `&maxPage=${maxPageVal}` +
            `&tries=${triesVal}` +
            `&amount=${amount}`
        );

        const data = await response.json();

        if (data && data.success && Array.isArray(data.items) && data.items.length > 0) {
            const fragment = document.createDocumentFragment();
            let addedCount = 0;
            
            data.items.forEach(item => {
                const uniqueKey = item.id || item.image;
                if (!loadedIds.has(uniqueKey)) {
                    loadedIds.add(uniqueKey);
                    const card = createCardElement(item);
                    fragment.appendChild(card);
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                gallery.appendChild(fragment);
                if (layoutCategory.value === "tiktok") initTikTokObserver();
            }
        }
    } catch (e) {
        console.error("Error fetching media:", e);
    } finally {
        randomBtn.disabled = false;
        randomBtn.textContent = "Random";
    }
}

// Tworzenie pojedynczego kafelka karty w galerii
function createCardElement(data) {
    const card = document.createElement("div");
    card.className = "card";

    if (data.type === "video") {
        card.classList.add("card-video");
        const video = document.createElement("video");
        video.src = data.image;
        video.loop = true;
        video.muted = isSmartSoundActive ? true : muted;
        video.volume = globalVolumeToggle.checked ? parseFloat(volumeSlider.value) : 0;
        video.controls = showNativeControls;

        if (!paused && !isSmartSoundActive) video.play().catch(() => {});

        card.appendChild(video);

        const zoom = document.createElement("button");
        zoom.className = "zoomBtn";
        zoom.textContent = "🔍";
        zoom.onclick = e => {
            e.stopPropagation();
            openPreview(data);
        };
        card.appendChild(zoom);

        card.onclick = (e) => {
            if (e.target.classList.contains("zoomBtn")) return;
            if (!showNativeControls) openPreview(data);
        };
    } else {
        const img = document.createElement("img");
        img.src = data.image;
        img.loading = "lazy";
        card.appendChild(img);
        card.onclick = () => openPreview(data);
    }

    return card;
}

// Kontrola globalna dźwięku i pauzy
muteBtn.onclick = () => {
    muted = !muted;
    document.querySelectorAll("video").forEach(v => {
        if (!isSmartSoundActive) v.muted = muted;
    });
    muteBtn.textContent = muted ? "🔇 Mute All" : "🔊 Unmute All";
    muteBtn.classList.toggle("active", muted);
};

pauseBtn.onclick = () => {
    paused = !paused;
    document.querySelectorAll("video").forEach(v => {
        if (paused) v.pause();
        else if (!isSmartSoundActive) v.play().catch(() => {});
    });
    pauseBtn.textContent = paused ? "⏸ Pause All" : "▶ Play All";
    pauseBtn.classList.toggle("active", paused);
};

nativeControlsBtn.onclick = () => {
    showNativeControls = !showNativeControls;
    document.querySelectorAll("video").forEach(v => v.controls = showNativeControls);
    nativeControlsBtn.textContent = showNativeControls ? "🎛 Controls: ON" : "🎛 Controls: OFF";
    nativeControlsBtn.classList.toggle("active", showNativeControls);
};

globalVolumeToggle.onchange = () => {
    const vol = globalVolumeToggle.checked ? parseFloat(volumeSlider.value) : 0;
    document.querySelectorAll("video").forEach(v => v.volume = vol);
};

volumeSlider.oninput = () => {
    if (globalVolumeToggle.checked) {
        const vol = parseFloat(volumeSlider.value);
        document.querySelectorAll("video").forEach(v => v.volume = vol);
    }
};

// --- Obsługa okna podglądu (Modal) ---
function openPreview(data) {
    currentMedia = data;
    previewContent.innerHTML = "";
    document.body.classList.add("preview-open");

    if (previewTags) {
        previewTags.innerHTML = "";
        if (data.tags) {
            const tagList = typeof data.tags === "string" ? data.tags.split(/\s+/) : data.tags;
            tagList.forEach(t => {
                if (!t) return;
                const wrapper = document.createElement("span");
                wrapper.className = "tag-item";

                const { category } = getTagCategoryAndColor(t);

                const qBtn = document.createElement("a");
                qBtn.className = "tag-search-btn";
                qBtn.textContent = "?";
                qBtn.href = data.site === "rule34" ? `https://rule34.xxx/index.php?page=post&s=list&tags=${encodeURIComponent(t)}` :
                            data.site === "safebooru" ? `https://safebooru.org/index.php?page=post&s=list&tags=${encodeURIComponent(t)}` :
                            data.site === "konachan" ? `https://konachan.com/post?tags=${encodeURIComponent(t)}` :
                            `https://wallhaven.cc/search?q=${encodeURIComponent(t)}`;
                qBtn.target = "_blank";
                qBtn.onclick = e => e.stopPropagation();

                const nameSpan = document.createElement("span");
                nameSpan.className = `tag-name tag-${category}`;
                nameSpan.textContent = t;
                
                nameSpan.onclick = async () => {
                    await navigator.clipboard.writeText(t);
                    const originalColor = nameSpan.style.color;
                    nameSpan.style.color = "#10b981";
                    setTimeout(() => nameSpan.style.color = originalColor, 1000);
                };

                wrapper.appendChild(qBtn);
                wrapper.appendChild(nameSpan);
                previewTags.appendChild(wrapper);
            });
        } else {
            previewTags.textContent = "Brak tagów";
        }
    }

    if (data.type === "video") {
        const video = document.createElement("video");
        video.src = data.image;
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.muted = false;
        video.volume = globalVolumeToggle.checked ? parseFloat(volumeSlider.value) : 1;
        previewContent.appendChild(video);
    } else {
        const img = document.createElement("img");
        img.src = data.image;
        previewContent.appendChild(img);
    }
    
    if (preview) {
        preview.classList.remove("hidden");
    }
}

closePreview.onclick = () => {
    preview.classList.add("hidden");
    previewContent.innerHTML = "";
    document.body.classList.remove("preview-open");
    currentMedia = null;
};

openPost.onclick = () => {
    if (!currentMedia) return;
    let url = currentMedia.site === "rule34" ? `https://rule34.xxx/index.php?page=post&s=view&id=${currentMedia.id}` :
              currentMedia.site === "safebooru" ? `https://safebooru.org/index.php?page=post&s=view&id=${currentMedia.id}` :
              currentMedia.site === "konachan" ? `https://konachan.com/post/show/${currentMedia.id}` : currentMedia.image;
    window.open(url, "_blank");
};

downloadMedia.onclick = async () => {
    if (!currentMedia) return;
    try {
        const response = await fetch(currentMedia.image);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = currentMedia.image.split("/").pop() || "media";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
    } catch {
        window.open(currentMedia.image, "_blank");
    }
};

copyLink.onclick = async () => {
    if (!currentMedia) return;
    await navigator.clipboard.writeText(currentMedia.image);
    copyLink.textContent = "✅ Copied";
    setTimeout(() => copyLink.textContent = "📋 Copy Link", 1500);
};

preview.onclick = e => {
    if (e.target === preview) closePreview.click();
};