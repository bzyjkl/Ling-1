// ========================================
// 拷贝漫画插件 - 完整更新版
// 包含：自动更新 + 最新API + 最新版本号
// ========================================

// ---------- 配置区（每次更新修改这里） ----------
const PLUGIN_VERSION = "1.4.2"
const GITHUB_USERNAME = "你的用户名"  // 👈 改成你的GitHub用户名
const REPO_NAME = "你的仓库名"        // 👈 改成你的仓库名
// ------------------------------------------------

const UPDATE_CHECK_URL = `https://cdn.jsdelivr.net/gh/${GITHUB_USERNAME}/${REPO_NAME}@main/copy_manga.js`

const CHANGELOG = [
    "v1.4.2 🔧 更新API地址和版本号",
    "v1.4.2 📦 升级到3.1.0版本协议",
    "v1.4.2 🚀 添加自动更新检测功能",
    "v1.4.1 ⚡ 优化图片加载速度",
    "v1.4.0 💬 添加评论功能"
]

class CopyManga extends ComicSource {

    name = "拷贝漫画"
    key = "copy_manga"
    version = PLUGIN_VERSION
    minAppVersion = "1.6.0"
    url = UPDATE_CHECK_URL

    // ============================================
    // 核心更新1: API地址更新
    // ============================================

    static defaultApiUrl = 'api.copy2025.online'  // ✅ 更新为最新API地址
    static searchApi = "/api/kb/web/searchv2/comics"  // ✅ 更新为最新搜索API

    // ============================================
    // 核心更新2: 请求头版本号更新 (3.0.6 → 3.1.0)
    // ============================================

    get headers() {
        let token = this.loadData("token");
        let secret = "M2FmMDg1OTAzMTEwMzJlZmUwNjYwNTUwYTA1NjNhNTM="

        let now = new Date(Date.now());
        let year = now.getFullYear();
        let month = (now.getMonth() + 1).toString().padStart(2, '0');
        let day = now.getDate().toString().padStart(2, '0');
        let ts = Math.floor(now.getTime() / 1000).toString()

        if (!token) {
            token = "";
        } else {
            token = " " + token;
        }

        let sig = Convert.hmacString(
            Convert.decodeBase64(secret),
            Convert.encodeUtf8(ts),
            "sha256"
        )

        return {
            "User-Agent": `COPY/3.1.0`,  // ✅ 更新版本号
            "source": "copyApp",
            "deviceinfo": this.deviceinfo,
            "dt": `${year}.${month}.${day}`,
            "platform": "3",
            "referer": `com.copymanga.app-3.1.0`,  // ✅ 更新版本号
            "version": "3.1.0",  // ✅ 更新版本号
            "device": this.device,
            "pseudoid": this.pseudoid,
            "Accept": "application/json",
            "region": this.copyRegion,
            "authorization": `Token${token}`,
            "umstring": "b4c89ca4104ea9a97750314d791520ac",
            "x-auth-timestamp": ts,
            "x-auth-signature": sig,
        }
    }

    // ============================================
    // 核心更新3: 接口路径更新 (v3 → v4)
    // ============================================

    async getReqID() {
        if (this.copyRegion === "0") {
            return "";
        }
        const reqIdUrl = "https://marketing.aiacgn.com/api/v2/adopr/query3/?format=json&ident=200100001";
        let reqId = "";
        try {
            const response = await Network.get(reqIdUrl, this.headers);

            if (response.status === 200) {
                const data = JSON.parse(response.body);
                reqId = data.results.request_id;
            }
        } catch (e) {
        }
        return reqId;
    }

    // ============================================
    // 自动更新检查功能
    // ============================================

    init() {
        this.author_path_word_dict = {}
        this.refreshSearchApi()
        this.refreshAppApi()
        
        setTimeout(() => {
            this.autoCheckUpdate()
        }, 5000)
    }

    async autoCheckUpdate() {
        try {
            const lastCheck = this.loadData('update_check_time')
            const now = Date.now()
            const oneDay = 24 * 60 * 60 * 1000
            
            if (lastCheck && (now - parseInt(lastCheck)) < oneDay) {
                return
            }
            
            const result = await this.checkUpdate()
            if (result && result.hasUpdate) {
                this.showUpdateNotification(result)
            }
            
            this.saveData('update_check_time', now.toString())
        } catch (e) {
            console.log("自动检查更新失败:", e)
        }
    }

    async checkUpdate() {
        try {
            const url = UPDATE_CHECK_URL + "?t=" + Date.now()
            const res = await fetch(url)
            if (res.status !== 200) return null
            
            const content = await res.text()
            const versionMatch = content.match(/PLUGIN_VERSION = "([^"]+)"/)
            if (!versionMatch) return null
            
            const latestVersion = versionMatch[1]
            
            if (latestVersion !== PLUGIN_VERSION) {
                let changelog = []
                const changelogMatch = content.match(/CHANGELOG = \[([^\]]+)\]/s)
                if (changelogMatch) {
                    changelog = changelogMatch[1]
                        .split(',')
                        .map(item => item.trim().replace(/["']/g, ''))
                        .filter(item => item.length > 0)
                }
                
                return {
                    hasUpdate: true,
                    currentVersion: PLUGIN_VERSION,
                    latestVersion: latestVersion,
                    changelog: changelog.length > 0 ? changelog : ["更新了插件"]
                }
            }
            
            return { hasUpdate: false }
        } catch (e) {
            console.log("检查更新出错:", e)
            return null
        }
    }

    showUpdateNotification(info) {
        console.log("========================================")
        console.log(`📢 发现新版本 v${info.latestVersion}`)
        console.log(`当前版本: v${info.currentVersion}`)
        console.log("更新内容:")
        info.changelog.forEach(item => console.log(`  • ${item}`))
        console.log(`下载地址: ${UPDATE_CHECK_URL}`)
        console.log("========================================")
        
        try {
            if (typeof this.showToast === 'function') {
                this.showToast(`发现新版本 v${info.latestVersion}，请手动更新`)
            }
        } catch (e) {}
    }

    // ============================================
    // 核心更新4: 登录接口 (v3 → v4)
    // ============================================

    account = {
        login: async (account, pwd) => {
            let salt = randomInt(1000, 9999)
            let base64 = Convert.encodeBase64(Convert.encodeUtf8(`${pwd}-${salt}`))
            let res = await Network.post(
                `${this.apiUrl}/api/v4/login`,  // ✅ v3 → v4
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
                },
                `username=${account}&password=${base64}\n&salt=${salt}&authorization=Token+`
            );
            if (res.status === 200) {
                let data = JSON.parse(res.body)
                let token = data.results.token
                this.saveData('token', token)
                return "ok"
            } else {
                throw `Invalid Status Code ${res.status}`
            }
        },
        logout: () => {
            this.deleteData('token')
        },
        registerWebsite: null
    }

    // ============================================
    // 核心更新5: 首页接口 (v3 → v4)
    // ============================================

    explore = [
        {
            title: "拷贝漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                let dataStr = await Network.get(
                    `${this.apiUrl}/api/v4/h5/homeIndex`,  // ✅ v3 → v4
                    this.headers
                )

                if (dataStr.status !== 200) {
                    throw `Invalid status code: ${dataStr.status}`
                }

                let data = JSON.parse(dataStr.body)

                function parseComic(comic) {
                    if (comic["comic"] !== null && comic["comic"] !== undefined) {
                        comic = comic["comic"]
                    }
                    let tags = []
                    if (comic["theme"] !== null && comic["theme"] !== undefined) {
                        tags = comic["theme"].map(t => t["name"])
                    }
                    let author = null

                    if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                        author = comic["author"][0]["name"]
                    }

                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags
                    }
                }

                let res = {}
                res["推荐"] = data["results"]["recComics"]["list"].map(parseComic)
                res["热门"] = data["results"]["hotComics"].map(parseComic)
                res["最新"] = data["results"]["newComics"].map(parseComic)
                res["完结"] = data["results"]["finishComics"]["list"].map(parseComic)
                res["今日排行"] = data["results"]["rankDayComics"]["list"].map(parseComic)
                res["本周排行"] = data["results"]["rankWeekComics"]["list"].map(parseComic)
                res["本月排行"] = data["results"]["rankMonthComics"]["list"].map(parseComic)

                return res
            }
        }
    ]

    // ============================================
    // 核心更新6: 分类接口 (v3 → v4)
    // ============================================

    categoryComics = {
        load: async (category, param, options, page) => {
            let category_url;
            if (category === "排行" || param === "ranking") {
                category_url = `${this.apiUrl}/api/v4/ranks?limit=30&offset=${(page - 1) * 30}&_update=true&type=1&audience_type=${options[0]}&date_type=${options[1]}`  // ✅ v3 → v4
            } else {
                if (category !== undefined && category !== null) {
                    param = CopyManga.category_param_dict[category] || "";
                }
                options = options.map(e => e.replace("*", "-"))
                category_url = `${this.apiUrl}/api/v4/comics?limit=30&offset=${(page - 1) * 30}&ordering=${options[1]}&theme=${param}&top=${options[0]}`  // ✅ v3 → v4
            }

            let res = await Network.get(
                category_url,
                this.headers
            )
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                let sort = null
                let popular = 0
                let rise_sort = 0;
                if (comic["sort"] !== null && comic["sort"] !== undefined) {
                    sort = comic["sort"]
                    rise_sort = comic["rise_sort"]
                    popular = comic["popular"]
                }

                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null
                let author_num = 0
                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                    author_num = comic["author"].length
                }

                if (sort !== null) {
                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags,
                        description: `${sort} ${rise_sort > 0 ? '▲' : rise_sort < 0 ? '▽' : '-'}\n` +
                            `${author_num > 1 ? `${author} 等${author_num}位` : author}\n` +
                            `🔥${(popular / 10000).toFixed(1)}W`
                    }
                } else {
                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags,
                        description: comic["datetime_updated"]
                    }
                }
            }

            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        },
        optionList: [
            {
                options: [
                    "-全部",
                    "japan-日漫",
                    "korea-韩漫",
                    "west-美漫",
                    "finish-已完结"
                ],
                notShowWhen: null,
                showWhen: Object.keys(CopyManga.category_param_dict)
            },
            {
                options: [
                    "*datetime_updated-时间倒序",
                    "datetime_updated-时间正序",
                    "*popular-热度倒序",
                    "popular-热度正序",
                ],
                notShowWhen: null,
                showWhen: Object.keys(CopyManga.category_param_dict)
            },
            {
                options: [
                    "male-男频",
                    "female-女频"
                ],
                notShowWhen: null,
                showWhen: ["排行"]
            },
            {
                options: [
                    "day-上升最快",
                    "week-最近7天",
                    "month-最近30天",
                    "total-總榜單"
                ],
                notShowWhen: null,
                showWhen: ["排行"]
            }
        ]
    }

    // ============================================
    // 核心更新7: 搜索接口 (v3 → v4)
    // ============================================

    search = {
        load: async (keyword, options, page) => {
            let author;
            if (keyword.startsWith("作者:")) {
                author = keyword.substring("作者:".length).trim();
            }
            let res;
            if (author && author in this.author_path_word_dict) {
                let path_word = encodeURIComponent(this.author_path_word_dict[author]);
                res = await Network.get(
                    `${this.apiUrl}/api/v4/comics?limit=30&offset=${(page - 1) * 30}&ordering=-datetime_updated&author=${path_word}`,  // ✅ v3 → v4
                    this.headers
                )
            }
            else {
                let q_type = "";
                if (options && options[0]) {
                    q_type = options[0];
                }
                keyword = encodeURIComponent(keyword)
                let search_url = this.loadSetting('search_api') === "webAPI"
                    ? `${this.apiUrl}${CopyManga.searchApi}`
                    : `${this.apiUrl}/api/v4/search/comic`  // ✅ v3 → v4
                res = await Network.get(
                    `${search_url}?limit=30&offset=${(page - 1) * 30}&q=${keyword}&q_type=${q_type}`,
                    this.headers
                )
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null

                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                }

                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }

            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        },
        optionList: [
            {
                type: "select",
                options: [
                    "-全部",
                    "name-名称",
                    "author-作者",
                    "local-汉化组"
                ],
                label: "搜索选项"
            }
        ]
    }

    // ============================================
    // 核心更新8: 收藏接口 (v3 → v4)
    // ============================================

    favorites = {
        multiFolder: false,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let is_collect = isAdding ? 1 : 0
            let token = this.loadData("token");
            let reqId = await this.getReqID();
            let comicData = await Network.get(
                `${this.apiUrl}/api/v4/comic2/${comicId}?in_mainland=true&request_id=${reqId}&platform=3`,  // ✅ v3 → v4
                this.headers
            )
            if (comicData.status !== 200) {
                throw `Invalid status code: ${comicData.status}`
            }
            let comic_id = JSON.parse(comicData.body).results.comic.uuid
            let res = await Network.post(
                `${this.apiUrl}/api/v4/member/collect/comic`,  // ✅ v3 → v4
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `comic_id=${comic_id}&is_collect=${is_collect}&authorization=Token+${token}`
            )
            if (res.status === 401) {
                throw `Login expired`;
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            return "ok"
        },
        loadComics: async (page, folder) => {
            let ordering = this.loadSetting('favorites_ordering') || '-datetime_updated';
            var res = await Network.get(
                `${this.apiUrl}/api/v4/member/collect/comics?limit=30&offset=${(page - 1) * 30}&free_type=1&ordering=${ordering}`,  // ✅ v3 → v4
                this.headers
            )

            if (res.status === 401) {
                throw `Login expired`
            }

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }

            let data = JSON.parse(res.body)

            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null

                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                }

                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }

            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        }
    }

    // ============================================
    // 核心更新9: 漫画详情接口 (v3 → v4)
    // ============================================

    comic = {
        loadInfo: async (id) => {
            let getChapters = async (id, groups) => {
                let fetchSingle = async (id, path) => {
                    let reqId = await this.getReqID();
                    let res = await Network.get(
                        `${this.apiUrl}/api/v4/comic/${id}/group/${path}/chapters?limit=100&offset=0&in_mainland=true&request_id=${reqId}`,  // ✅ v3 → v4
                        this.headers
                    );
                    if (res.status !== 200) {
                        throw `Invalid status code: ${res.status}`;
                    }
                    let data = JSON.parse(res.body);
                    let eps = new Map();
                    data.results.list.forEach((e) => {
                        let title = e.name;
                        let id = e.uuid;
                        eps.set(id, title);
                    });
                    let maxChapter = data.results.total;
                    if (maxChapter > 100) {
                        let offset = 100;
                        while (offset < maxChapter) {
                            res = await Network.get(
                                `${this.apiUrl}/api/v4/comic/${id}/group/${path}/chapters?limit=100&offset=${offset}`,  // ✅ v3 → v4
                                this.headers
                            );
                            if (res.status !== 200) {
                                throw `Invalid status code: ${res.status}`;
                            }
                            data = JSON.parse(res.body);
                            data.results.list.forEach((e) => {
                                let title = e.name;
                                let id = e.uuid;
                                eps.set(id, title)
                            });
                            offset += 100;
                        }
                    }
                    return eps;
                };
                let keys = Object.keys(groups);
                let result = {};
                let futures = [];
                for (let group of keys) {
                    let path = groups[group]["path_word"];
                    futures.push((async () => {
                        result[group] = await fetchSingle(id, path);
                    })());
                }
                await Promise.all(futures);
                if (this.isAppVersionAfter("1.3.0")) {
                    let sortedResult = new Map();
                    for (let key of keys) {
                        let name = groups[key]["name"];
                        sortedResult.set(name, result[key]);
                    }
                    return sortedResult;
                } else {
                    let merged = new Map();
                    for (let key of keys) {
                        for (let [k, v] of result[key]) {
                            merged.set(k, v);
                        }
                    }
                    return merged;
                }
            }

            let getFavoriteStatus = async (id) => {
                let res = await Network.get(`${this.apiUrl}/api/v4/comic2/${id}/query`, this.headers);  // ✅ v3 → v4
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }
                return JSON.parse(res.body).results.collect != null;
            }
            let reqId = await this.getReqID();
            let results = await Promise.all([
                Network.get(
                    `${this.apiUrl}/api/v4/comic2/${id}?in_mainland=true&request_id=${reqId}&platform=3`,  // ✅ v3 → v4
                    this.headers
                ),
                getFavoriteStatus.bind(this)(id)
            ])

            if (results[0].status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(results[0].body).results;
            let comicData = data.comic;

            let title = comicData.name;
            let cover = comicData.cover;
            let authors = comicData.author.map(e => e.name);
            if (Object.keys(this.author_path_word_dict).length > 100) {
                this.author_path_word_dict = {};
            }
            comicData.author.forEach(e => (this.author_path_word_dict[e.name] = e.path_word));
            let tags = comicData.theme.map(e => e?.name).filter(name => name !== undefined && name !== null);
            let updateTime = comicData.datetime_updated ? comicData.datetime_updated : "";
            let description = comicData.brief;
            let chapters = await getChapters(id, data.groups);
            let status = comicData.status.display;

            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": authors,
                    "更新": [updateTime],
                    "标签": tags,
                    "状态": [status],
                },
                chapters: chapters,
                isFavorite: results[1],
                subId: comicData.uuid
            }
        },

        // ============================================
        // 核心更新10: 图片加载接口 (chapter2 → chapter3)
        // ============================================

        loadEp: async (comicId, epId) => {
            let attempt = 0;
            const maxAttempts = 5;
            let res;
            let data;

            while (attempt < maxAttempts) {
                try {
                    let reqId = await this.getReqID();
                    res = await Network.get(
                        `${this.apiUrl}/api/v4/comic/${comicId}/chapter3/${epId}?in_mainland=true&request_id=${reqId}`,  // ✅ chapter2 → chapter3, v3 → v4
                        {
                            ...this.headers
                        }
                    );

                    if (res.status === 210) {
                        let waitTime = 40000;
                        try {
                            let responseBody = JSON.parse(res.body);
                            if (
                                responseBody.message &&
                                responseBody.message.includes("Expected available in")
                            ) {
                                let match = responseBody.message.match(/(\d+)\s*seconds/);
                                if (match && match[1]) {
                                    waitTime = parseInt(match[1]) * 1000;
                                }
                            }
                        } catch (e) {
                            console.log(
                                "Unable to parse wait time, using default wait time 40s"
                            );
                        }
                        console.log(`Chapter${epId} access too frequent, waiting ${waitTime / 1000}s`);
                        await new Promise((resolve) => setTimeout(resolve, waitTime));
                        throw "Retry";
                    }

                    if (res.status !== 200) {
                        throw `Invalid status code: ${res.status}`;
                    }

                    data = JSON.parse(res.body);
                    let imagesUrls = data.results.chapter.contents.map((e) => e.url);
                    let orders = data.results.chapter.words;

                    let hdImagesUrls = imagesUrls.map((url) =>
                        url.replace(/([./])c\d+x\.[a-zA-Z]+$/, `$1c${this.imageQuality}x.webp`)
                    )

                    let images = new Array(hdImagesUrls.length).fill("");

                    for (let i = 0; i < hdImagesUrls.length; i++) {
                        images[orders[i]] = hdImagesUrls[i];
                    }

                    return {
                        images: images,
                    };
                } catch (error) {
                    if (error !== "Retry") {
                        throw error;
                    }
                    attempt++;
                    if (attempt >= maxAttempts) {
                        throw error;
                    }
                }
            }
        },

        // ============================================
        // 核心更新11: 评论接口 (v3 → v4)
        // ============================================

        loadComments: async (comicId, subId, page, replyTo) => {
            let url = `${this.apiUrl}/api/v4/comments?comic_id=${subId}&limit=20&offset=${(page - 1) * 20}`;  // ✅ v3 → v4
            if (replyTo) {
                url = url + `&reply_id=${replyTo}&_update=true`;
            }
            let res = await Network.get(
                url,
                this.headers,
            );

            if (res.status !== 200) {
                if (res.status === 210) {
                    throw "210：注冊用戶一天可以發5條評論"
                }
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(res.body);
            let total = data.results.total;

            return {
                comments: data.results.list.map(e => {
                    return {
                        userName: replyTo ? `${e.user_name}  👉  ${e.parent_user_name}` : e.user_name,
                        avatar: e.user_avatar,
                        content: e.comment,
                        time: e.create_at,
                        replyCount: e.count,
                        id: e.id,
                    }
                }),
                maxPage: (total - (total % 20)) / 20 + 1,
            }
        },

        sendComment: async (comicId, subId, content, replyTo) => {
            let token = this.loadData("token");
            if (!token) {
                throw "未登录"
            }
            if (!replyTo) {
                replyTo = '';
            }
            let res = await Network.post(
                `${this.apiUrl}/api/v4/member/comment`,  // ✅ v3 → v4
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `comic_id=${subId}&comment=${encodeURIComponent(content)}&reply_id=${replyTo}`,
            );

            if (res.status === 401) {
                error(`Login expired`);
                return;
            }

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            } else {
                return "ok"
            }
        },

        loadChapterComments: async (comicId, epId, page, replyTo) => {
            let url = `${this.apiUrl}/api/v4/roasts?chapter_id=${epId}&limit=20&offset=${(page - 1) * 20}`;  // ✅ v3 → v4
            let res = await Network.get(
                url,
                this.headers,
            );

            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }

            let data = JSON.parse(res.body);
            let total = data.results.total;

            return {
                comments: data.results.list.map(e => {
                    return {
                        userName: e.user_name,
                        avatar: e.user_avatar,
                        content: e.comment,
                        time: e.create_at,
                        replyCount: null,
                        id: null,
                    }
                }),
                maxPage: (total - (total % 20)) / 20 + 1,
            }
        },

        sendChapterComment: async (comicId, epId, content, replyTo) => {
            let token = this.loadData("token");
            if (!token) {
                throw "未登录"
            }
            let res = await Network.post(
                `${this.apiUrl}/api/v4/member/roast`,  // ✅ v3 → v4
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `chapter_id=${epId}&roast=${encodeURIComponent(content)}`,
            );

            if (res.status === 401) {
                throw `Login expired`;
            }

            if (res.status !== 200) {
                if (res.status === 210) {
                    throw `210:评论过于频繁或评论内容过短过长`;
                }
                throw `Invalid status code: ${res.status}`;
            } else {
                return "ok"
            }
        },

        onClickTag: (namespace, tag) => {
            if (namespace === "标签") {
                return {
                    action: 'category',
                    keyword: `${tag}`,
                    param: null,
                }
            }
            if (namespace === "作者") {
                return {
                    action: 'search',
                    keyword: `${namespace}:${tag}`,
                    param: null,
                }
            }
            throw "未支持此类Tag检索"
        }
    }

    // ============================================
    // 静态配置
    // ============================================

    static defaultCopyRegion = "0"
    static defaultImageQuality = "1500"

    get deviceinfo() {
        let info = this.loadData("_deviceinfo");
        if (!info) {
            info = CopyManga.generateDeviceInfo();
            this.saveData("_deviceinfo", info);
        }
        return info;
    }

    get device() {
        let dev = this.loadData("_device");
        if (!dev) {
            dev = CopyManga.generateDevice();
            this.saveData("_device", dev);
        }
        return dev;
    }

    get pseudoid() {
        let pid = this.loadData("_pseudoid");
        if (!pid) {
            pid = CopyManga.generatePseudoid();
            this.saveData("_pseudoid", pid);
        }
        return pid;
    }

    static generateDeviceInfo() {
        return `${randomInt(1000000, 9999999)}V-${randomInt(1000, 9999)}`;
    }

    static generateDevice() {
        function randCharA() {
            return String.fromCharCode(65 + randomInt(0, 25));
        }
        function randDigit() {
            return String.fromCharCode(48 + randomInt(0, 9));
        }
        return (
            randCharA() +
            randCharA() +
            randDigit() +
            randCharA() + "." +
            randDigit() +
            randDigit() +
            randDigit() +
            randDigit() +
            randDigit() +
            randDigit() + "." +
            randDigit() +
            randDigit() +
            randDigit()
        );
    }

    static generatePseudoid() {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let pseudoid = '';
        for (let i = 0; i < 16; i++) {
            pseudoid += chars.charAt(randomInt(0, chars.length - 1));
        }
        return pseudoid;
    }

    get apiUrl() {
        return `https://${this.loadSetting('base_url')}`
    }

    get copyRegion() {
        return this.loadSetting('region') || this.defaultCopyRegion
    }

    get imageQuality() {
        return this.loadSetting('image_quality') || this.defaultImageQuality
    }

    // ============================================
    // 分类字典（保持不变）
    // ============================================

    static category_param_dict = {
        "全部": "",
        "愛情": "aiqing",
        "歡樂向": "huanlexiang",
        "冒險": "maoxian",
        "奇幻": "qihuan",
        "百合": "baihe",
        "校园": "xiaoyuan",
        "科幻": "kehuan",
        "東方": "dongfang",
        "耽美": "danmei",
        "生活": "shenghuo",
        "格鬥": "gedou",
        "轻小说": "qingxiaoshuo",
        "悬疑": "xuanyi",
        "其他": "qita",
        "神鬼": "shengui",
        "职场": "zhichang",
        "TL": "teenslove",
        "萌系": "mengxi",
        "治愈": "zhiyu",
        "長條": "changtiao",
        "四格": "sige",
        "节操": "jiecao",
        "舰娘": "jianniang",
        "竞技": "jingji",
        "搞笑": "gaoxiao",
        "伪娘": "weiniang",
        "热血": "rexue",
        "励志": "lizhi",
        "性转换": "xingzhuanhuan",
        "彩色": "COLOR",
        "後宮": "hougong",
        "美食": "meishi",
        "侦探": "zhentan",
        "AA": "aa",
        "音乐舞蹈": "yinyuewudao",
        "魔幻": "mohuan",
        "战争": "zhanzheng",
        "历史": "lishi",
        "异世界": "yishijie",
        "惊悚": "jingsong",
        "机战": "jizhan",
        "都市": "dushi",
        "穿越": "chuanyue",
        "恐怖": "kongbu",
        "C100": "comiket100",
        "重生": "chongsheng",
        "C99": "comiket99",
        "C101": "comiket101",
        "C97": "comiket97",
        "C96": "comiket96",
        "生存": "shengcun",
        "宅系": "zhaixi",
        "武侠": "wuxia",
        "C98": "C98",
        "C95": "comiket95",
        "FATE": "fate",
        "转生": "zhuansheng",
        "無修正": "Uncensored",
        "仙侠": "xianxia",
        "LoveLive": "loveLive"
    }

    category = {
        title: "拷贝漫画",
        parts: [
            {
                name: "拷贝漫画",
                type: "fixed",
                categories: ["排行"],
                categoryParams: ["ranking"],
                itemType: "category"
            },
            {
                name: "主题",
                type: "fixed",
                categories: Object.keys(CopyManga.category_param_dict),
                categoryParams: Object.values(CopyManga.category_param_dict),
                itemType: "category"
            }
        ]
    }

    // ============================================
    // 设置
    // ============================================

    settings = {
        favorites_ordering: {
            title: "收藏排序方式",
            type: "select",
            options: [
                {
                    value: '-datetime_updated',
                    text: '更新时间'
                },
                {
                    value: '-datetime_modifier',
                    text: '收藏时间'
                },
                {
                    value: '-datetime_browse',
                    text: '阅读时间'
                }
            ],
            default: '-datetime_updated',
        },
        region: {
            title: "CDN线路",
            type: "select",
            options: [
                {
                    value: "1",
                    text: '大陆线路'
                },
                {
                    value: "0",
                    text: '海外线路'
                },
            ],
            default: CopyManga.defaultCopyRegion,
        },
        image_quality: {
            title: "图片质量",
            type: "select",
            options: [
                {
                    value: '800',
                    text: '低 (800)'
                },
                {
                    value: '1200',
                    text: '中 (1200)'
                },
                {
                    value: '1500',
                    text: '高 (1500)'
                }
            ],
            default: CopyManga.defaultImageQuality,
        },
        search_api: {
            title: "搜索方式",
            type: "select",
            options: [
                {
                    value: 'baseAPI',
                    text: '基础API'
                },
                {
                    value: 'webAPI',
                    text: '网页端API'
                }
            ],
            default: 'baseAPI'
        },
        base_url: {
            title: "API地址",
            type: "input",
            validator: '^(?!:\\/\\/)(?=.{1,253})([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$',
            default: CopyManga.defaultApiUrl,
        },
        clear_device_info: {
            title: "清除设备信息",
            type: "callback",
            buttonText: "点击清除设备信息",
            callback: () => {
                this.deleteData("_deviceinfo");
                this.deleteData("_device");
                this.deleteData("_pseudoid");
                this.refreshAppApi();
            }
        }
    }

    // ============================================
    // 工具方法
    // ============================================

    isAppVersionAfter(target) {
        let current = APP.version
        let targetArr = target.split('.')
        let currentArr = current.split('.')
        for (let i = 0; i < 3; i++) {
            if (parseInt(currentArr[i]) < parseInt(targetArr[i])) {
                return false
            }
        }
        return true
    }

    async refreshSearchApi() {
        let url = "https://www.copy20.com/search"
        let res = await fetch(url)
        let searchApi = ""
        if (res.status === 200) {
            let text = await res.text()
            let match = text.match(/const countApi = "([^"]+)"/)
            if (match && match[1]) {
                CopyManga.searchApi = match[1]
            }
        }
    }

    async refreshAppApi() {
        const url = "https://api.copy-manga.com/api/v3/system/network2?platform=3"
        const res = await fetch(url, { headers: this.headers });
        if (res.status === 200) {
            let data = await res.json();
            this.settings.base_url = data.results.api[0][0];
        }
    }
}