var API_ORIGIN = "https://test.conflux.one";
var API_BASE = API_ORIGIN + "/pubapi/tmdb/3";
var IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
var PROFILE_BASE = "https://image.tmdb.org/t/p/w185";

var GENRES_ZH = {
  28: "动作",
  12: "冒险",
  16: "动画",
  35: "喜剧",
  80: "犯罪",
  99: "纪录",
  18: "剧情",
  10751: "家庭",
  14: "奇幻",
  36: "历史",
  27: "恐怖",
  10402: "音乐",
  9648: "悬疑",
  10749: "爱情",
  878: "科幻",
  10770: "电视电影",
  53: "惊悚",
  10752: "战争",
  37: "西部",
};

var GENRES_EN = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

function tmdbLanguage(ctx) {
  var locale = ctx && ctx.locale ? String(ctx.locale) : "";
  if (locale.toLowerCase().indexOf("zh") === 0) {
    return "zh-CN";
  }
  return "en-US";
}

function imageURL(path, base) {
  if (!path || typeof path !== "string") {
    return undefined;
  }
  if (path.indexOf("http://") === 0 || path.indexOf("https://") === 0) {
    return path;
  }
  return (base || IMAGE_BASE) + path;
}

function genreTitle(ids, language) {
  if (!ids || !ids.length) {
    return undefined;
  }
  var map = language === "zh-CN" ? GENRES_ZH : GENRES_EN;
  return map[ids[0]];
}

function movieItem(movie, language) {
  var item = {
    ref: { source: "tmdb", id: String(movie.id), mediaType: "movie" },
    title: movie.title || movie.original_title || "",
  };
  if (movie.overview) {
    item.description = movie.overview;
  }
  if (typeof movie.vote_average === "number") {
    item.rating = movie.vote_average;
  }
  if (movie.release_date) {
    item.releaseDate = movie.release_date;
  }
  var genre = genreTitle(movie.genre_ids, language);
  if (genre) {
    item.genre = genre;
  }
  var poster = imageURL(movie.poster_path);
  var backdrop = imageURL(movie.backdrop_path);
  if (poster || backdrop) {
    item.images = {};
    if (poster) {
      item.images.poster = poster;
    }
    if (backdrop) {
      item.images.backdrop = backdrop;
    }
  }
  return item;
}

function throwHTTP(status, message) {
  if (status === 404) {
    throw ExtensionError({ code: "not_found", message: message || "Not found", retryable: false });
  }
  if (status === 429) {
    throw ExtensionError({ code: "rate_limited", message: message || "Rate limited", retryable: true });
  }
  if (status >= 500) {
    throw ExtensionError({
      code: "unavailable",
      message: message || "TMDB proxy unavailable",
      retryable: true,
    });
  }
  throw ExtensionError({
    code: "unavailable",
    message: message || "Request failed (" + status + ")",
    retryable: true,
  });
}

function tmdbErrorMessage(data, fallback) {
  if (data && typeof data === "object") {
    if (typeof data.status_message === "string" && data.status_message) {
      return data.status_message;
    }
    if (typeof data.message === "string" && data.message) {
      return data.message;
    }
  }
  if (typeof data === "string" && data) {
    return data;
  }
  return fallback;
}

function tmdbBody(data) {
  if (typeof data === "string") {
    var trimmed = data.replace(/^\s+|\s+$/g, "");
    if (!trimmed) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw ExtensionError({
        code: "unavailable",
        message: "Invalid TMDB JSON",
        retryable: true,
      });
    }
  }
  return data;
}

async function tmdbGet(ctx, path, query) {
  var res;
  try {
    res = await ctx.http.get(API_BASE + path, {
      query: query,
      timeoutMs: 15000,
    });
  } catch (error) {
    throw ExtensionError({
      code: "unavailable",
      message: (error && error.message) || "TMDB request failed",
      retryable: true,
    });
  }
  var data = tmdbBody(res.data);
  if (res.status < 200 || res.status >= 300) {
    throwHTTP(res.status, tmdbErrorMessage(data, "TMDB request failed (" + res.status + ")"));
  }
  return data;
}

function movieResults(data) {
  if (!data || typeof data !== "object") {
    throw ExtensionError({
      code: "unavailable",
      message: "Unexpected TMDB response",
      retryable: true,
    });
  }
  return data.results || [];
}

async function loadMovieList(ctx, listType) {
  var language = tmdbLanguage(ctx);
  var data = await tmdbGet(ctx, "/movie/" + listType, {
    language: language,
    page: "1",
  });
  var results = movieResults(data);
  console.log(listType, language, "items", results.length);
  return {
    items: results.map(function (movie) {
      return movieItem(movie, language);
    }),
  };
}

function pageToken(input) {
  if (input && input.page && input.page.type === "page" && typeof input.page.page === "number" && input.page.page > 0) {
    return input.page.page;
  }
  return 1;
}

var placeholderItems = [
  {
    ref: { source: "tmdb", id: "969681", mediaType: "movie" },
    title: "蜘蛛侠：崭新之日",
    releaseDate: "2026-07-29",
    genre: "科幻",
    images: {
      poster: "https://image.tmdb.org/t/p/w500/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg",
      backdrop: "https://image.tmdb.org/t/p/w500/qeQJx07rK2xm8SD2sJxFKhE7gs0.jpg",
    },
  },
  {
    ref: { source: "tmdb", id: "1368337", mediaType: "movie" },
    title: "奥德赛",
    releaseDate: "2026-07-15",
    genre: "冒险",
    images: {
      poster: "https://image.tmdb.org/t/p/w500/5rhTDKUhPYvpdQIijFIs5VoWsON.jpg",
      backdrop: "https://image.tmdb.org/t/p/w500/twiVn9oFXOVR0uoYgawyEBlnFu8.jpg",
    },
  },
  {
    ref: { source: "tmdb", id: "1288445", mediaType: "movie" },
    title: "怒之杀",
    releaseDate: "2026-08-19",
    genre: "动作",
    images: {
      poster: "https://image.tmdb.org/t/p/w500/pu2VxGlpGwffOx292w18b1tv96j.jpg",
      backdrop: "https://image.tmdb.org/t/p/w500/qDa0fqDqIBCovRp975RvtGPcuN3.jpg",
    },
  },
  {
    ref: { source: "tmdb", id: "1204680", mediaType: "movie" },
    title: "歪心狼对阵ACME",
    releaseDate: "2026-08-20",
    genre: "喜剧",
    images: {
      poster: "https://image.tmdb.org/t/p/w500/orkLtdgMGiO9rTVMqJ1kKwrnup1.jpg",
      backdrop: "https://image.tmdb.org/t/p/w500/l9mFW9HQnAZ4r1ChZJHoOT3jaal.jpg",
    },
  },
  {
    ref: { source: "tmdb", id: "1516698", mediaType: "movie" },
    title: "最后的曙光",
    releaseDate: "2026-08-26",
    genre: "爱情",
    images: {
      poster: "https://image.tmdb.org/t/p/w500/3PWJqDfygN0YNNjWsDUOXclCp3h.jpg",
      backdrop: "https://image.tmdb.org/t/p/w500/zFCWfU2ViMIm38G1W8UsnSpqmWn.jpg",
    },
  },
  {
    ref: { source: "tmdb", id: "1386315", mediaType: "movie" },
    title: "生死时限",
    releaseDate: "2026-09-03",
    genre: "惊悚",
    images: {
      poster: "https://image.tmdb.org/t/p/w500/uxCaBoYXsDC4A0SqTm3SISj0OwK.jpg",
      backdrop: "https://image.tmdb.org/t/p/w500/ziXF8wIBguHNCeplNthUlDTCZP8.jpg",
    },
  },
];

function placeholderContent(count) {
  return { items: placeholderItems.slice(0, count) };
}

function listWidget(id, title, template, listType, count) {
  return {
    type: "widget",
    id: id,
    title: title,
    template: template,
    cache: { ttlSeconds: 21600 },
    placeholderData: placeholderContent(count),
    load: async function (ctx) {
      return loadMovieList(ctx, listType);
    },
    placeholder: async function () {
      return placeholderContent(count);
    },
  };
}

definePackage({
  id: "conflux.daily",
  title: "每日推荐",
  description: "TMDB 每日电影榜单：正在热映、热门、即将上映。",
  version: "1.0.1",
  engine: 1,
  permissions: { network: ["https://test.conflux.one"] },
  extensions: [
    listWidget("now-playing", "正在热映", "poster-grid", "now_playing", 6),
    listWidget("popular", "热门电影", "poster-ranked", "popular", 3),
    listWidget("upcoming", "即将上映", "poster-grid", "upcoming", 6),
    {
      type: "search",
      id: "movie",
      title: "电影搜索",
      search: async function (ctx, input) {
        var query = input.query || "";
        if (!query) {
          return { items: [] };
        }
        var language = tmdbLanguage(ctx);
        var page = pageToken(input);
        var data = await tmdbGet(ctx, "/search/movie", {
          query: query,
          language: language,
          page: String(page),
        });
        var results = movieResults(data);
        var content = {
          items: results.map(function (movie) {
            return movieItem(movie, language);
          }),
        };
        var totalPages = data && data.total_pages;
        if (typeof totalPages === "number" && page < totalPages) {
          content.next = { type: "page", page: page + 1 };
        }
        return content;
      },
    },
    {
      type: "detail",
      id: "movie",
      title: "电影详情",
      accepts: { sources: ["tmdb"], mediaTypes: ["movie"] },
      cache: { ttlSeconds: 3600 },
      load: async function (ctx, input) {
        var ref = input.ref || {};
        if (ref.source !== "tmdb" || !ref.id) {
          return null;
        }
        if (ref.mediaType && ref.mediaType !== "movie") {
          return null;
        }
        var language = tmdbLanguage(ctx);
        var data;
        try {
          data = await tmdbGet(ctx, "/movie/" + encodeURIComponent(ref.id), {
            language: language,
            append_to_response: "credits,images,videos",
            include_image_language: "zh,en,null",
          });
        } catch (error) {
          if (error && error.code === "not_found") {
            return null;
          }
          throw error;
        }
        if (!data || data.id == null) {
          return null;
        }
        var item = movieItem(
          {
            id: data.id,
            title: data.title,
            original_title: data.original_title,
            overview: data.overview,
            vote_average: data.vote_average,
            release_date: data.release_date,
            poster_path: data.poster_path,
            backdrop_path: data.backdrop_path,
            genre_ids: (data.genres || []).map(function (genre) {
              return genre.id;
            }),
          },
          language
        );
        item.ref = { source: "tmdb", id: String(data.id), mediaType: "movie" };
        if (typeof data.runtime === "number" && data.runtime > 0) {
          item.runtimeSeconds = data.runtime * 60;
        }
        if (data.genres && data.genres.length) {
          item.genres = data.genres.map(function (genre) {
            return { id: String(genre.id), title: genre.name };
          });
          if (!item.genre && item.genres[0]) {
            item.genre = item.genres[0].title;
          }
        }
        var people = [];
        var credits = data.credits || {};
        var crew = credits.crew || [];
        var directorRole = language === "zh-CN" ? "导演" : "Director";
        for (var i = 0; i < crew.length; i++) {
          var member = crew[i];
          if (member.job !== "Director") {
            continue;
          }
          var director = { id: String(member.id), title: member.name, role: directorRole };
          var directorAvatar = imageURL(member.profile_path, PROFILE_BASE);
          if (directorAvatar) {
            director.avatar = directorAvatar;
          }
          people.push(director);
        }
        var cast = credits.cast || [];
        for (var c = 0; c < cast.length && people.length < 16; c++) {
          var actor = cast[c];
          var person = { id: String(actor.id), title: actor.name };
          if (actor.character) {
            person.role = actor.character;
          }
          var avatar = imageURL(actor.profile_path, PROFILE_BASE);
          if (avatar) {
            person.avatar = avatar;
          }
          people.push(person);
        }
        if (people.length) {
          item.people = people;
        }
        var stills = [];
        var backdrops = ((data.images || {}).backdrops) || [];
        for (var b = 0; b < backdrops.length && stills.length < 12; b++) {
          var still = imageURL(backdrops[b].file_path);
          if (still) {
            stills.push(still);
          }
        }
        if (stills.length) {
          if (!item.images) {
            item.images = {};
          }
          item.images.stills = stills;
        }
        var trailers = [];
        var videos = ((data.videos || {}).results) || [];
        for (var v = 0; v < videos.length && trailers.length < 6; v++) {
          var video = videos[v];
          if (video.site !== "YouTube") {
            continue;
          }
          if (video.type !== "Trailer" && video.type !== "Teaser") {
            continue;
          }
          trailers.push({
            title: video.name,
            url: "https://www.youtube.com/watch?v=" + video.key,
          });
        }
        if (trailers.length) {
          item.trailers = trailers;
        }
        return item;
      },
    },
  ],
});
