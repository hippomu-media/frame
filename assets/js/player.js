window.addEventListener("message", async e => {
  // Meta para testar o player APENAS em localhost
  const href = window.location.href
  if (href.startsWith("http://127.0.0.1") || href.startsWith("http://localhost")) {
    let meta = document.createElement('meta');
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = "upgrade-insecure-requests";
    document.getElementsByTagName('head')[0].appendChild(meta);
  }

  console.log('[CR Premium] Player encontrado!')

  // Variáveis principais
  const r = { 0: '720', 1: '1080', 2: '480', 3: '360', 4: '240' };
  const lgLangs = { "ptBR": "Português (BR)", "enUS": "English (US)", "enGB": "English (UK)", "esLA": "Español (LA)", "esES": "Español (ES)", "ptPT": "Português (PT)", "frFR": "Français (FR)", "deDE": "Deutsch (DE)", "arME": "(ME) عربي", "itIT": "Italiano (IT)", "ruRU": "Русский (RU)" }
  const epLangs = { "ptBR": "Episódio", "enUS": "Episode", "enGB": "Episode", "esLA": "Episodio", "esES": "Episodio", "ptPT": "Episódio", "frFR": "Épisode", "deDE": "Folge", "arME": "الحلقة", "itIT": "Episodio", "ruRU": "Серия" };
  const fnLangs = { "ptBR": "FINAL", "enUS": "FINAL", "enGB": "FINAL", "esLA": "FINAL", "esES": "FINAL", "ptPT": "FINAL", "frFR": "FINALE", "deDE": "FINALE", "arME": "نهائي", "itIT": "FINALE", "ruRU": "ФИНАЛЬНЫЙ" };

  let is_beta = e.data.beta;
  let force_mp4 = e.data.force_mp4;
  let streamrgx = /_,(\d+.mp4),(\d+.mp4),(\d+.mp4),(?:(\d+.mp4),(\d+.mp4),)?.*?m3u8/;
  let video_config_media = await getConfigMedia(e.data.video_config_media, e.data.old_url);
  let video_id = video_config_media['metadata']['id'];
  let up_next_cooldown = e.data.up_next_cooldown;
  let up_next_enable = e.data.up_next_enable;
  let up_next = (e.data.up_next && !video_config_media['metadata']['up_next']) ? false : e.data.up_next;
  let thumbs = up_next ? video_config_media['metadata']['up_next']['thumbnails'] : [];
  let version = e.data.version;
  let user_lang = e.data.lang;
  let series = e.data.series;
  let video_stream_url = "";
  let stream_languages = [];
  let video_m3u8_array = {};
  let video_mp4_array = {};
  let rows_number = {};
  let tracks = {};
  let dlSize = [];
  let dlUrl = [];
  for (let idx in r) {
    dlSize[idx] = document.getElementById(r[idx] + "_down_size");
    dlUrl[idx] = document.getElementById(r[idx] + "_down_url");
  }

  if (force_mp4) console.log("[CR Premium] Forçando MP4 (chromecast workaround)")

  // Obter streams
  const streamlist = video_config_media['streams'];
  const sourceLocale = getSourceLocale()

  for (let stream of streamlist) {
    const streamLang = stream.hardsub_lang ? stream.hardsub_lang : 'off';
    if (!video_mp4_array[streamLang]) { stream_languages.push(streamLang); tracks[streamLang] = []; video_mp4_array[streamLang] = []; rows_number[streamLang] = -1 }

    // Padrão
    if (stream.format == 'adaptive_hls') {
      video_stream_url = stream.url;
      video_m3u8_array[streamLang] = force_mp4 ? mp4ListFromStream(video_stream_url) : m3u8ListFromStream(video_stream_url);
      video_mp4_array[streamLang] = mp4ListFromStream(video_stream_url);
    }
    // Premium
    else if (stream.format == 'trailer_hls')
      if (++rows_number[streamLang] <= 4) {
        // TODO: video_m3u8_array.push(await getDirectStream(stream.url, rows_number[streamLang]));
        const arr_idx = (rows_number[streamLang] === 0 ? 2 : (rows_number[streamLang] === 2 ? 0 : rows_number[streamLang]));
        video_mp4_array[streamLang][arr_idx] = getDirectFile(stream.url);
        video_m3u8_array[streamLang] = video_mp4_array[streamLang];
      }
  }

  // Popular tracks e carregar player
  stream_languages.forEach(lang => {
    if (Array.isArray(video_m3u8_array[lang]))
      for (let idx of [1, 0, 2, 3, 4])
        tracks[lang].push({ file: video_m3u8_array[lang][idx], label: toResolution(r[idx]) });
    else
      tracks[lang] = { file: video_m3u8_array[lang], type: "m3u" }
  });

  (() => {
    // Inicia o player
    let playerInstance = jwplayer("player_div")
    playerInstance.setup({
      "playlist": [
        {
          "title": getLocalEpisodeTitle(),
          "description": video_config_media['metadata']['title'],
          "image": video_config_media['thumbnail']['url'],
          "sources": tracks[sourceLocale] || tracks["off"],
          "tracks": buildTracks(tracks)
        },
        up_next_enable && up_next ? {
          "autoplaytimer": 0,
          "title": video_config_media['metadata']['up_next']['display_episode_number'] + ' - ' + video_config_media['metadata']['up_next']['series_title'],
          "file": "https://i.imgur.com/8wEeX0R.mp4",
          "repeat": true,
          "image": thumbs[thumbs.length - 1].url
        } : {}
      ],
      "related": { displayMode: 'none' },
      "nextupoffset": -up_next_cooldown,
      "width": "100%",
      "height": "100%",
      "autostart": false,
      "displayPlaybackLabel": true,
      "primary": "html5",
      "cast": {},
      "playbackRateControls": [0.5, 0.75, 1, 1.25, 1.5, 2]
    }).on('playlistItem', e => {
      // tocar próximo ep
      if (e.index > 0 && up_next_enable && up_next) {
        jwplayer().setControls(false);
        jwplayer().setConfig({
          repeat: true
        });
        jwplayer().play();
        localStorage.setItem("next_up", true);
        localStorage.setItem("next_up_fullscreen", jwplayer().getFullscreen());
        window.top.location.href = up_next;
      }
    }).on("captionsChanged", el => {
      const { tracks: captions, track: captionIndex } = el
      const position = jwplayer().getPosition()
      playlist = jwplayer().getPlaylist()
      trackId = captions[captionIndex].id
      track = trackId === "off" ? tracks["off"] : (trackId === "default" ? tracks[locale] || tracks["off"] : trackId)
      playlist[0].file = undefined
      playlist[0].allSources = undefined
      playlist[0].sources = track
      playlist[0].tracks = buildTracks(tracks)
      jwplayer().load(playlist)
      jwplayer().play()
      const seek = setInterval(el => {
        if (jwplayer().getState() === 'playing') {
          jwplayer().seek(position)
          clearInterval(seek)
        }
      }, 5)
    })

    // Variaveis para os botões.
    let update_iconPath = "assets/icon/update_icon.svg";
    let update_id = "update-video-button";
    let update_tooltipText = "Atualização Disponível";

    let rewind_iconPath = "assets/icon/replay-10s.svg";
    let rewind_id = "rewind-video-button";
    let rewind_tooltipText = "Voltar 10s";

    let forward_iconPath = "assets/icon/forward-30s.svg";
    let forward_id = "forward-video-button";
    let forward_tooltipText = "Avançar 30s";

    let download_iconPath = "assets/icon/download_icon.svg";
    let download_id = "download-video-button";
    let download_tooltipText = "Download";
    let didDownload = false;

    const rewind_ButtonClickAction = () => jwplayer().seek(jwplayer().getPosition() - 10)
    const forward_ButtonClickAction = () => jwplayer().seek(jwplayer().getPosition() + 30)

    const downloadModal = document.querySelectorAll(".modal")[0];
    const updateModal = document.querySelectorAll(".modal")[1];
    document.querySelectorAll("button.close-modal")[0].onclick = () => downloadModal.style.visibility = "hidden";
    document.querySelectorAll("button.close-modal")[1].onclick = () => updateModal.style.visibility = "hidden";

    // function ao clicar no botao de baixar
    function download_ButtonClickAction() {
      // Se estiver no mobile, muda um pouco o design do menu
      if (jwplayer().getEnvironment().OS.mobile == true) {
        downloadModal.style.height = "170px";
        downloadModal.style.overflow = "auto";
      }

      // Mostra o menu de download
      downloadModal.style.visibility = downloadModal.style.visibility === "hidden" ? "visible" : "hidden";

      // Carrega os downloads
      if (!didDownload) {
        didDownload = true;
        console.log('[CR Premium] Baixando sources:')
        for (let id of [1, 0, 2, 3, 4])
          linkDownload(id);
      }
    }
    // function ao clicar no botao de update
    function update_ButtonClickAction() {
      if (jwplayer().getEnvironment().OS.mobile == true) {
        updateModal.style.height = "170px";
        updateModal.style.overflow = "auto";
      }
      updateModal.style.visibility = updateModal.style.visibility === "hidden" ? "visible" : "hidden";
    }

    playerInstance
      .addButton(forward_iconPath, forward_tooltipText, forward_ButtonClickAction, forward_id)
      .addButton(rewind_iconPath, rewind_tooltipText, rewind_ButtonClickAction, rewind_id)
      .addButton(download_iconPath, download_tooltipText, download_ButtonClickAction, download_id);

    if (version !== "1.2.0")
      playerInstance.addButton(update_iconPath, update_tooltipText, update_ButtonClickAction, update_id);

    // Definir URL e Tamanho na lista de download
    for (let id of [1, 0, 2, 3, 4]) {
      const sourceLang = getSourceLocale()
      dlUrl[id].href = video_mp4_array[sourceLang][id];
      dlUrl[id].download = video_config_media['metadata']['title'];
    }

    // Funções para o player
    jwplayer().on('ready', () => {
      // Seta o tempo do video pro salvo no localStorage		
      if (localStorage.getItem(video_id) != null) {
        const t = localStorage.getItem(video_id);
        document.getElementsByTagName("video")[0].currentTime = t >= 5 ? t - 5 : t;
      }
      // Mantem fullscreen + autoplay caso tenha sido redirecionado usando a função "A seguir"/"Next up"
      if (localStorage.getItem("next_up") === "true") {
        localStorage.setItem("next_up", false)
        // jwplayer().setFullscreen(localStorage.getItem("next_up_fullscreen")); <- problemas com fullscreen automatico
        jwplayer().play();
      }

      document.body.querySelector(".loading_container").style.display = "none";
    }).on('viewable', () => {
      const old = document.querySelector('.jw-button-container > .jw-icon-rewind')
      if (!old) return
      const btn = query => document.querySelector(`div[button="${query}"]`)
      const btnContainer = old.parentElement
      if (btn(rewind_id)) {
        btnContainer.insertBefore(btn(rewind_id), old)
        btnContainer.insertBefore(btn(forward_id), old)
        btnContainer.removeChild(old)
      }
      if (is_beta && document.getElementById('player_div'))
        document.getElementById('player_div').classList.add('beta-layout')
    }).on('error', e => {
      console.log(e)
    });

    // Salva o tempo do video a cada 7 segundos.
    setInterval(() => {
      if (jwplayer().getState() == "playing")
        localStorage.setItem(video_id, jwplayer().getPosition());
    }, 7000);
  })()

  /* ~~~~~~~~~~ FUNÇÕES ~~~~~~~~~~ */
  // MP4 (download) - Premium: Obtem o link direto pelo trailer
  function getDirectFile(url) {
    return url.replace(/\/clipFrom.*?index.m3u8/, '').replace('_,', '_').replace(url.split("/")[2], "fy.v.vrv.co");
  }

  // MP4 (download) - Grátis: Obtem o link direto pelo padrão
  function mp4ListFromStream(url) {
    const cleanUrl = url.replace('evs1', 'evs').replace(url.split("/")[2], "fy.v.vrv.co");
    const res = streamrgx.exec(cleanUrl).slice(1).map(streamfile => streamfile && cleanUrl.replace(streamrgx, `_${streamfile}`)).filter(el => el !== undefined);

    if (res.length === 3) {
      const [el1, el2, ...tail] = res
      return [el2, el1, ...tail]
    }
    return res;
  }

  // M3U8 (assistir) - Premium: Obtem o link direto pelo trailer
  function getDirectStream(url, idx) {
    // TODO: assistir premium pelo m3u8 (por enquanto usamos o mp4)
  }

  // M3U8 (assistir) - Grátis: Obtem o link direto pelo padrão
  function m3u8ListFromStream(url) {
    return url;
  }

  // Checa se o URL do video_mp4_array[lang][id] existe e calcula o tamanho p/ download
  function linkDownload(id, tentativas = 0) {
    const sourceLang = getSourceLocale()
    console.log('  - Baixando (' + sourceLang + '): ', r[id])
    let video_mp4_url = video_mp4_array[sourceLang][id];
    if (!video_mp4_url) return disableDownload(id)

    let fileSize = "";
    let http = (window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP"));
    http.onreadystatechange = () => {
      if (http.readyState == 4 && http.status == 200) {
        fileSize = http.getResponseHeader('content-length');
        if (!fileSize)
          return setTimeout(() => linkDownload(id), 5000);
        else {
          let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
          if (fileSize == 0) return console.log('addSource#fileSize == 0');
          let i = parseInt(Math.floor(Math.log(fileSize) / Math.log(1024)));
          if (i == 0) return console.log('addSource#i == 0');
          let return_fileSize = (fileSize / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
          dlSize[id].innerText = return_fileSize;
          return console.log(`[CR Premium] Source adicionado: ${r[id]} (${return_fileSize})`);
        }
      } else if (http.readyState == 4 && tentativas < 3)
        return setTimeout(() => linkDownload(id, tentativas + 1), 5000);
      else if (http.readyState == 4)
        return disableDownload(id)

    }
    http.open("HEAD", video_mp4_url, true);
    http.send(null);
  }

  function getLocalEpisodeTitle() {
    const episode_translate = `${epLangs[user_lang[0]] ? epLangs[user_lang[0]] : "Episode"} `;
    const final_translate = ` (${fnLangs[user_lang[0]] ? fnLangs[user_lang[0]] : "FINAL"})`;

    if (series) {
      return series + ' - ' + episode_translate + video_config_media['metadata']['display_episode_number'];
    } else if (video_config_media['metadata']['up_next']) {
      let prox_ep_number = video_config_media['metadata']['up_next']['display_episode_number'];
      return video_config_media['metadata']['up_next']['series_title'] + ' - ' + prox_ep_number.replace(/\d+|OVA/g, '') + video_config_media['metadata']['display_episode_number'];
    } else
      return episode_translate + video_config_media['metadata']['display_episode_number'] + final_translate;
  }

  function fetch(url) {
    return new Promise(async (resolve, reject) => {
      await $.ajax({
        async: true,
        type: "GET",
        url: url,
        responseType: 'json'
      })
        .then(res => {
          resolve(res.contents ?? res)
        })
        .catch(err => reject(err));
    })
  }

  async function getConfigMedia(video_config_media, old_url) {
    if (video_config_media)
      return JSON.parse(video_config_media)
    else if (old_url) {
      const localelessUrl = old_url.split('/').length == 6 ? old_url.replace(/\.com\/[^/]*?\//, '.com/') : old_url
      console.log("[CR Beta] URL universal:", localelessUrl)
      const media_content = await getVilosMedia(localelessUrl)
      return JSON.parse(media_content)
    }
    else return {}
  }

  async function getVilosMedia(url) {
    const htmlPage = await fetch(url)
    if (!htmlPage) return '{}'

    const startIndex = htmlPage.indexOf('config.media =')
    const initialConfig = htmlPage.substr(startIndex + 15)

    const endIndex = initialConfig.indexOf('\n\n')
    const config = initialConfig.substr(0, endIndex - 1)
    return config || '{}'
  }

  function toResolution(resolution) {
    return parseInt(resolution) >= 720 ? `${resolution}p<sup><sup>HD</sup></sup>` : `${resolution}p`
  }

  function disableDownload(id) {
    dlUrl[id].style.pointerEvents = "none";
    dlUrl[id].style.cursor = "default";
    dlUrl[id].style.filter = "invert(49%)"
    dlSize[id].innerText = "🚫"
  }

  function buildTracks(tracks) {
    return Object.entries(tracks).map(entry => {
      const [lang, track] = entry
      return {
        "kind": "captions",
        "file": track,
        "label": lgLangs[lang] || lang,
        "language": lang
      }
    }).filter(track => track["language"] !== "off")
  }

  function getSourceLocale() {
    const jwplayerLocale = Object.keys(lgLangs).find(el => lgLangs[el] === localStorage.getItem("jwplayer.captionLabel"))
    if (!jwplayerLocale) localStorage.setItem("jwplayer.captionLabel", lgLangs[user_lang])
    const sourceLocale = jwplayerLocale ? jwplayerLocale : user_lang
    const hasUserLang = streamlist.find(stream => stream.hardsub_lang == sourceLocale);
    return hasUserLang ? sourceLocale : 'off'
  }

let titlea = video_config_media['metadata']['title'];
document.getElementById("title").innerHTML = titlea;
let episodenum = video_config_media['metadata']['display_episode_number'];
let epi = "EPISODE ";
document.getElementById("episode").innerHTML = epi + episodenum;
let imagea = video_config_media['thumbnail']['url'];
document.getElementById("image").innerHTML = imagea;
let desc = video_config_media['metadata']['description'];
document.getElementById("desc").innerHTML = desc;

let subname0 = video_config_media['subtitles'][0]['language'];
document.getElementById("subname0").innerHTML = subname0;
let suburl0 = video_config_media['subtitles'][0]['url'];
let suburl0split = suburl0.split('?')[0];
let result0 = suburl0split.replace("https://v", "https://fy.v");
document.getElementById("suburl0").innerHTML = result0;

let subname1 = video_config_media['subtitles'][1]['language'];
document.getElementById("subname1").innerHTML = subname1;
let suburl1 = video_config_media['subtitles'][1]['url'];
let suburl1split = suburl1.split('?')[0];
let result1 = suburl1split.replace("https://v", "https://fy.v");
document.getElementById("suburl1").innerHTML = result1;

let subname2 = video_config_media['subtitles'][2]['language'];
document.getElementById("subname2").innerHTML = subname2;
let suburl2 = video_config_media['subtitles'][2]['url'];
let suburl2split = suburl2.split('?')[0];
let result2 = suburl2split.replace("https://v", "https://fy.v");
document.getElementById("suburl2").innerHTML = result2;

let subname3 = video_config_media['subtitles'][3]['language'];
document.getElementById("subname3").innerHTML = subname3;
let suburl3 = video_config_media['subtitles'][3]['url'];
let suburl3split = suburl3.split('?')[0];
let result3 = suburl3split.replace("https://v", "https://fy.v");
document.getElementById("suburl3").innerHTML = result3;

let subname4 = video_config_media['subtitles'][4]['language'];
document.getElementById("subname4").innerHTML = subname4;
let suburl4 = video_config_media['subtitles'][4]['url'];
let suburl4split = suburl4.split('?')[0];
let result4 = suburl4split.replace("https://v", "https://fy.v");
document.getElementById("suburl4").innerHTML = result4;

let subname5 = video_config_media['subtitles'][5]['language'];
document.getElementById("subname5").innerHTML = subname5;
let suburl5 = video_config_media['subtitles'][5]['url'];
let suburl5split = suburl5.split('?')[0];
let result5 = suburl5split.replace("https://v", "https://fy.v");
document.getElementById("suburl5").innerHTML = result5;

let subname6 = video_config_media['subtitles'][6]['language'];
document.getElementById("subname6").innerHTML = subname6;
let suburl6 = video_config_media['subtitles'][6]['url'];
let suburl6split = suburl6.split('?')[0];
let result6 = suburl6split.replace("https://v", "https://fy.v");
document.getElementById("suburl6").innerHTML = result6;

let subname7 = video_config_media['subtitles'][7]['language'];
document.getElementById("subname7").innerHTML = subname7;
let suburl7 = video_config_media['subtitles'][7]['url'];
let suburl7split = suburl7.split('?')[0];
let result7 = suburl7split.replace("https://v", "https://fy.v");
document.getElementById("suburl7").innerHTML = result7;

let subname8 = video_config_media['subtitles'][8]['language'];
document.getElementById("subname8").innerHTML = subname8;
let suburl8 = video_config_media['subtitles'][8]['url'];
let suburl8split = suburl8.split('?')[0];
let result8 = suburl8split.replace("https://v", "https://fy.v");
document.getElementById("suburl8").innerHTML = result8;

let subname9 = video_config_media['subtitles'][9]['language'];
document.getElementById("subname9").innerHTML = subname9;
let suburl9 = video_config_media['subtitles'][9]['url'];
let suburl9split = suburl9.split('?')[0];
let result9 = suburl9split.replace("https://v", "https://fy.v");
document.getElementById("suburl9").innerHTML = result9;

let subname10 = video_config_media['subtitles'][10]['language'];
document.getElementById("subname10").innerHTML = subname10;
let suburl10 = video_config_media['subtitles'][10]['url'];
let suburl10split = suburl10.split('?')[0];
let result10 = suburl10split.replace("https://v", "https://fy.v");
document.getElementById("suburl10").innerHTML = result10;

let subname11 = video_config_media['subtitles'][11]['language'];
document.getElementById("subname11").innerHTML = subname11;
let suburl11 = video_config_media['subtitles'][11]['url'];
let suburl11split = suburl11.split('?')[0];
let result11 = suburl11split.replace("https://v", "https://fy.v");
document.getElementById("suburl11").innerHTML = result11;

let subname12 = video_config_media['subtitles'][12]['language'];
document.getElementById("subname12").innerHTML = subname12;
let suburl12 = video_config_media['subtitles'][12]['url'];
let suburl12split = suburl12.split('?')[0];
let result12 = suburl12split.replace("https://v", "https://fy.v");
document.getElementById("suburl12").innerHTML = result12;
});
