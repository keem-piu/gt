/* GTA LIVE V7 — based on the user's original index.html, not the V5/V6 UI.
   GitHub Pages: official snapshot in data/streamers.json; optional original direct
   kick.com/api/v2/channels fetch only when the browser really permits it.
   Kick iframe: https://player.kick.com/<slug> (Kick official embed).
*/
(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const STALE_MS = 95 * 60 * 1000;
  const REFRESH_MS = 5 * 60 * 1000;
  const DIRECT_RETRY_MS = 15 * 60 * 1000;
  const IMG_CDN = (slug) => `https://images.kick.com/channels/${encodeURIComponent(slug)}/profile_small`;
  const qs = new URLSearchParams(location.search);
  const params = { q:'', filter:'all', sort:'default' };
  const state = { names:[], sponsor:'keempiu', cards:new Map(), records:new Map(), checkedAt: null, source:'',
                  directMode:'not_checked', lastDirectCheck:0, refreshing:false, activePlayers:new Set(),
                  favorites: new Set(), lastMessage:'', snapshotSuccess:0 };
  const allowedName = name => typeof name==='string' && /^[a-zA-Z0-9_]{1,30}$/.test(name);
  const safeUrl = s => typeof s==='string' && /^https:\/\/[^\s<>'"`]+$/i.test(s) && s.length<2048 ? s : null;
  const slug = name => encodeURIComponent(name);
  const truthDate = s => {
    if(typeof s!=='string') return null;
    const clean=s.trim().replace(' ','T');
    const iso=/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(?:\.\d+)?)?(Z|[+-]\d\d:?\d\d)?$/i.test(clean);
    if(!iso) return null;
    const withZone=/(Z|[+-]\d\d:?\d\d)$/i.test(clean)?clean:clean+'Z';
    const ts=Date.parse(withZone);
    return Number.isFinite(ts) && ts>Date.UTC(2010,0,1) && ts<Date.now()+86400000 ? new Date(ts).toISOString():null;
  };
  const ago = iso => {
    const value=truthDate(iso); if(!value) return 'Tarih alınamadı';
    const m=Math.max(0,Math.floor((Date.now()-Date.parse(value))/60000));
    if(m<60) return m<=1?'Az önce':`${m} dk önce`;
    if(m<1440) return `${Math.floor(m/60)} sa önce`;
    return `${Math.floor(m/1440)} gün önce`;
  };
  const absolute = iso => truthDate(iso) ? new Date(iso).toLocaleString('tr-TR',{dateStyle:'medium',timeStyle:'short'}): '';
  const humanCount = n => typeof n==='number'&&Number.isFinite(n)?new Intl.NumberFormat('tr-TR',{notation:n>=1000?'compact':'standard',maximumFractionDigits:1}).format(n):'—';
  const elapsed = iso => {
    if(!truthDate(iso))return '—';
    const sec=Math.max(0,Math.floor((Date.now()-Date.parse(iso))/1000)), hr=Math.floor(sec/3600), min=Math.floor((sec%3600)/60);
    return hr?`${hr} sa ${min} dk`:`${min} dk`;
  };
  function loadFavorites(){ try{ const x=JSON.parse(localStorage.getItem('kick-gta-favorites')||'[]'); if(Array.isArray(x)) state.favorites=new Set(x.filter(allowedName));}catch(e){} }
  function persistFavorites(){try{localStorage.setItem('kick-gta-favorites',JSON.stringify([...state.favorites]));}catch(e){} }
  function basic(name){return {username:name,status:'unknown',title:`${name} Kanalı`,category:'GTA',viewers:null,profileImage:null,thumbnail:null,startTime:null,lastStream:null,lastStreamSource:null,lastVideoAt:null,checkedAt:null};}
  function normalize(input,name){
    const x=(input && typeof input==='object')?input:{};
    let status=['live','offline'].includes(x.status)?x.status:'unknown';
    const checked= typeof x.checkedAt==='number'?x.checkedAt:Date.parse(x.checkedAt||'');
    if(!Number.isFinite(checked)||checked<=0||Date.now()-checked>STALE_MS||checked>Date.now()+60000)status='unknown';
    return {username:name,status,title:typeof x.title==='string'?x.title.slice(0,250):`${name} Kanalı`,
      category:typeof x.category==='string'?x.category.slice(0,70):'GTA',
      viewers:Number.isFinite(Number(x.viewers))&&x.viewers!==null?Math.max(0,Number(x.viewers)):null,
      profileImage:safeUrl(x.profileImage||x.profilePic||x.profile_pic),thumbnail:safeUrl(x.thumbnail),
      startTime:status==='live'?truthDate(x.startTime):null,
      lastStream:truthDate(x.lastStream),lastStreamSource:x.lastStreamSource||null,
      lastVideoAt:truthDate(x.lastVideoAt), checkedAt:status==='unknown'?null:checked};
  }
  function mergeOne(name,patch,source){
    if(!state.records.has(name))return;
    const old=state.records.get(name);
    const candidate=normalize({...old,...patch},name);
    if(source==='snapshot' && old.checkedAt && candidate.checkedAt && candidate.checkedAt<old.checkedAt)return;
    for(const f of ['profileImage','thumbnail','lastStream','lastVideoAt']) if(!candidate[f]&&old[f])candidate[f]=old[f];
    if(candidate.status==='live'&&candidate.startTime) candidate.lastStream=candidate.startTime;
    if(candidate.status==='unknown' && old.checkedAt && (Date.now()-old.checkedAt)<STALE_MS && source==='snapshot'){
      candidate.status=old.status;candidate.checkedAt=old.checkedAt;candidate.startTime=old.startTime;
    }
    state.records.set(name,candidate);
    updateCard(name);
  }
  function img(name,classname) {
    const node=document.createElement('img');node.className=classname;node.alt=`${name} profil resmi`;node.loading='lazy';node.decoding='async';
    node.onerror=()=>{ if(!node.dataset.triedCdn && node.src!==IMG_CDN(name)){node.dataset.triedCdn='1';node.src=IMG_CDN(name);}else{node.style.display='none';node.parentElement?.classList.add('image-failed');} };
    node.onload=()=>node.parentElement?.classList.add('has-image');node.src=IMG_CDN(name);return node;
  }
  function make(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
  function makeLink(label,url){const a=make('a','',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
  function makeCard(name){
    const card=make('article','streamer-card');card.dataset.username=name;
    const media=make('div','streamer-media');
    const overlay=make('div','media-overlay');const imgWrap=make('div','media-image');
    const pic=img(name,'profile-image'); imgWrap.append(pic,make('span','initials',name.slice(0,2).toUpperCase()));
    const caption=make('span','media-caption','Durum kontrol ediliyor');
    const play=make('button','media-play','▶ Yayını aç');play.type='button';play.addEventListener('click',()=>openPlayer(name));
    overlay.append(imgWrap,caption,play);media.append(overlay);
    const info=make('div','streamer-info');const head=make('div','streamer-header');
    const avatarWrap=make('div','avatar-wrapper');avatarWrap.append(img(name,'streamer-avatar'),make('span','initials',name.slice(0,2).toUpperCase()));
    const titleWrap=make('div','streamer-name-container');titleWrap.append(makeLink(name,`https://kick.com/${slug(name)}`),make('div','streamer-title',`${name} Kanalı`));titleWrap.firstChild.className='streamer-name';
    const fav=make('button','favorite-btn','☆');fav.type='button';fav.setAttribute('aria-label',`Favorilere ekle: ${name}`);
    fav.addEventListener('click',()=>{state.favorites.has(name)?state.favorites.delete(name):state.favorites.add(name);persistFavorites();updateCard(name);applyFilters();});
    head.append(avatarWrap,titleWrap,fav);
    const meta=make('div','streamer-meta');const category=make('span','streamer-category','GTA'),viewers=make('span','viewer-count','👁 —'),duration=make('span','live-duration','—');meta.append(category,viewers,duration);
    const last=make('div','last-stream');last.append(make('span','','◷ Son yayın:'),make('strong','','Tarih alınamadı'));
    const links=make('div','player-links');
    const link=makeLink('Kick’te izle ↗',`https://kick.com/${slug(name)}`);
    const videos=makeLink('Yayın videoları ↗',`https://kick.com/${slug(name)}/videos`);
    links.append(link,videos);
    info.append(head,meta,last,links);card.append(media,info);
    if(name===state.sponsor){card.classList.add('sponsored');const sponsor=make('div','sponsored-badge','★ SPONSOR');media.append(sponsor);}
    state.cards.set(name,{card,media,overlay,pic,avatar:avatarWrap.querySelector('img'),caption,title:titleWrap.lastChild,fav,category,viewers,duration,last:last.querySelector('strong'),play});
    return card;
  }
  function updateCard(name){
    const refs=state.cards.get(name),d=state.records.get(name);if(!refs||!d)return;
    const {card,caption,title,fav,category,viewers,duration,last,pic,avatar}=refs;
    card.classList.toggle('live',d.status==='live');
    title.textContent=d.title || `${name} Kanalı`;
    category.textContent=d.category || 'GTA';
    viewers.textContent=`👁 ${d.status==='live'?humanCount(d.viewers):'—'}`;
    duration.textContent=d.status==='live'?`◷ ${elapsed(d.startTime)}`:'—';
    caption.textContent=d.status==='live'?'🔴 CANLI':d.status==='offline'?'ÇEVRİMDIŞI':'DURUM DOĞRULANAMADI';
    caption.className='media-caption '+d.status;
    const recent=d.lastStream || d.lastVideoAt;
    last.textContent=recent?`${d.lastStream?'Yayın başlangıcı':'Arşiv videosu'}: ${ago(recent)} · ${absolute(recent)}`:'Kick geçmişi doğrulanamadı';
    fav.textContent=state.favorites.has(name)?'★':'☆';fav.setAttribute('aria-pressed',String(state.favorites.has(name)));
    fav.setAttribute('aria-label',state.favorites.has(name)?`Favorilerden çıkar: ${name}`:`Favorilere ekle: ${name}`);
    [pic,avatar].forEach(el=>{
      if(d.profileImage && el.dataset.profileUrl!==d.profileImage){el.dataset.profileUrl=d.profileImage;el.dataset.triedCdn='';el.style.display='block';el.parentElement?.classList.remove('image-failed');el.parentElement?.classList.remove('has-image');el.src=d.profileImage;}
    });
  }
  function openPlayer(name){
    const ref=state.cards.get(name);if(!ref)return;
    if(state.activePlayers.has(name))return;
    const media=ref.media;
    ref.overlay.hidden=true;
    const iframe=document.createElement('iframe');iframe.className='streamer-iframe';
    iframe.title=`${name} Kick canlı yayın oynatıcısı`;
    iframe.src=`https://player.kick.com/${slug(name)}?autoplay=true&muted=true`;
    iframe.allow='autoplay; fullscreen; picture-in-picture';iframe.allowFullscreen=true;iframe.setAttribute('scrolling','no');
    // The provider player must not be sandboxed; embed follows Kick's official URL.
    const close=make('button','player-exit','✕ Kapat');close.type='button';close.addEventListener('click',()=>closePlayer(name));
    media.append(iframe,close);state.activePlayers.add(name);
  }
  function closePlayer(name){
    const ref=state.cards.get(name);if(!ref)return;
    ref.media.querySelector('iframe')?.remove();ref.media.querySelector('.player-exit')?.remove();
    ref.overlay.hidden=false;state.activePlayers.delete(name);
  }
  function sortKey(d){return d.status==='live'?0:d.status==='offline'?1:2;}
  function applyFilters(){
    const q=params.q;
    let visible=0;
    const sorted=[...state.names];
    sorted.sort((a,b)=>{
      const A=state.records.get(a),B=state.records.get(b);
      if(params.sort==='name') return a.localeCompare(b,'tr');
      if(params.sort==='viewers')return (B.viewers||0)-(A.viewers||0)||a.localeCompare(b);
      if(params.sort==='recent')return (Date.parse(B.lastStream||B.lastVideoAt||0)||0)-(Date.parse(A.lastStream||A.lastVideoAt||0)||0);
      const f= x => (state.favorites.has(x)?0:1);
      const s= x => x===state.sponsor?0:1;
      return sortKey(A)-sortKey(B)||f(a)-f(b)||s(a)-s(b)||(B.viewers||0)-(A.viewers||0);
    });
    const list=$('#streamer-list');
    // Moving an active iframe inside the DOM restarts playback on some browsers.
    // Freeze current DOM order while any player is open; the filtering below is safe.
    if(!state.activePlayers.size)for(const name of sorted)list.appendChild(state.cards.get(name).card);
    for(const name of state.names){
      const d=state.records.get(name),card=state.cards.get(name).card;
      const matches=(!q || name.toLowerCase().includes(q)||d.title.toLowerCase().includes(q)) &&
        (params.filter==='all'||params.filter==='favorites'&&state.favorites.has(name)||params.filter==='live'&&d.status==='live'||params.filter==='offline'&&d.status==='offline');
      card.hidden=!matches;if(matches)visible++;
    }
    $('#empty-message').hidden=visible>0;
    document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===params.filter));
    $('#data-status').textContent=statusLine();
  }
  function statusLine(){
    const vals=[...state.records.values()],live=vals.filter(v=>v.status==='live').length,offline=vals.filter(v=>v.status==='offline').length;
    const unknown=vals.length-live-offline;
    const info=`${vals.length} kanal · 🔴 ${live} canlı · ${offline} çevrimdışı · ${unknown} doğrulanamadı.`;
    const snapshot=state.checkedAt?` Son API kontrolü: ${absolute(new Date(state.checkedAt).toISOString())}.`:' Henüz başarılı doğrulama yok.';
    const detail=state.directMode==='blocked'?' Tarayıcıdan Kick API erişimi engellendi; GitHub Actions verisi gerekiyor.':
      state.directMode==='ok'?' Orijinal doğrudan kanal sorgusu çalışıyor.':'';
    return info+snapshot+detail+(state.lastMessage?' '+state.lastMessage:'');
  }
  function directRecord(raw,name){
    if(!raw||typeof raw!=='object'||!raw.user)return null;
    const current=raw.livestream && typeof raw.livestream==='object'?raw.livestream:null;
    // Crucial original bug: livestream objects commonly omit `is_live`.
    const live=!!current && current.is_live!==false && (current.id!=null||current.created_at||current.is_live===true);
    const prev=raw.recent_livestream&&typeof raw.recent_livestream==='object'?raw.recent_livestream:{};
    return {status:live?'live':'offline',checkedAt:Date.now(),
      title:(live?current.session_title:null)||raw.stream_title||`${name} Kanalı`,
      category: (live?current.categories?.[0]?.name:null)||'GTA',
      viewers:live?(Number(current.viewer_count)||0):null,
      profileImage:safeUrl(raw.user.profile_pic||raw.user.profile_picture||raw.profile_pic||raw.profile_picture),
      thumbnail:safeUrl(current?.thumbnail?.url||current?.thumbnail),
      startTime:live?truthDate(current.created_at||current.started_at):null,
      lastStream:truthDate(current?.created_at||prev.created_at||raw.last_live_at),
      lastStreamSource:current?.created_at?'observed':prev.created_at?'recent_livestream':'last_live_at'};
  }
  async function getJson(url,timeout=8500){
    const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),timeout);
    try{const r=await fetch(url,{signal:abort.signal,cache:'no-store'});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json();}finally{clearTimeout(timer);}
  }
  async function fetchSnapshot(){
    try{
      const data=await getJson(`./data/streamers.json?v=${Date.now()}`,8000);
      if(!data||!Array.isArray(data.channels))throw Error('Veri dosyasının biçimi bozuk');
      for(const raw of data.channels){const name=String(raw?.username||'').toLowerCase();if(state.records.has(name))mergeOne(name,raw,'snapshot');}
      const t=Number(data.checkedAt);
      state.snapshotSuccess=Number(data.successCount)||0;
      if(Number.isFinite(t)&&t>0&&Date.now()-t<STALE_MS)state.checkedAt=t;
      state.source=String(data.source||'');
      if(state.source==='unconfigured')state.lastMessage='Kick geliştirici anahtarları GitHub Actions Secrets bölümünde henüz yok.';
      else if(state.source==='kick-unavailable')state.lastMessage='Kick API son güncellemede cevap vermemiş.';
      else state.lastMessage='';
      applyFilters();
      return true;
    }catch(e){state.lastMessage='GitHub Pages veri dosyası okunamadı: '+e.message;applyFilters();return false;}
  }
  async function tryDirect(force=false){
    if(state.directMode==='blocked'&&!force)return;
    if(!force && Date.now()-state.lastDirectCheck<DIRECT_RETRY_MS)return;
    state.lastDirectCheck=Date.now();
    const first=state.names.includes('flavorr')?'flavorr':state.names[0];
    try{
      const response=await getJson(`https://kick.com/api/v2/channels/${slug(first)}`,8000);
      const parsed=directRecord(response,first);
      if(!parsed)throw Error('Beklenmeyen Kick yanıtı');
      state.directMode='ok';mergeOne(first,parsed,'direct');
    }catch(err){state.directMode='blocked';applyFilters();return;}
    // Only fan out after a REAL successful browser fetch. Stop on first systemic failures.
    let index=0,errors=0;
    const rest=state.names.filter(n=>n!==first);
    const worker=async()=>{while(index<rest.length&&errors<5){
      const name=rest[index++];
      try{const raw=await getJson(`https://kick.com/api/v2/channels/${slug(name)}`,9000);
        const parsed=directRecord(raw,name);if(!parsed)throw Error('Bad payload');mergeOne(name,parsed,'direct');}
      catch(e){errors++;}
    }};
    await Promise.all(Array.from({length:4},()=>worker()));
    state.checkedAt=Date.now();state.lastMessage=errors?'Bazı kanallar doğrudan sorgulanamadı.':'';
    applyFilters();
  }
  async function refresh(force=false){
    if(state.refreshing)return;
    state.refreshing=true;
    $('#loading').hidden=false;
    try{await fetchSnapshot();await tryDirect(force);}finally{state.refreshing=false;$('#loading').hidden=true;applyFilters();}
  }
  function initEvents(){
    let debounce;
    $('#search-input').addEventListener('input',ev=>{clearTimeout(debounce);debounce=setTimeout(()=>{params.q=ev.target.value.trim().toLowerCase();applyFilters();},180);});
    $('#search-form').addEventListener('submit',ev=>ev.preventDefault());
    $('#sort-select').addEventListener('change',ev=>{params.sort=ev.target.value;applyFilters();});
    document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{params.filter=b.dataset.filter;applyFilters();}));
    $('#refresh-button').addEventListener('click',()=>refresh(true));
    setInterval(()=>{for(const name of state.names)if(state.records.get(name)?.status==='live')updateCard(name);},60000);
    setInterval(()=>refresh(),REFRESH_MS);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden && state.checkedAt && Date.now()-state.checkedAt>STALE_MS){for(const name of state.names){const d=state.records.get(name);if(d.status!=='unknown'){d.status='unknown';updateCard(name);}}applyFilters();}});
  }
  async function init(){
    loadFavorites();initEvents();
    try{
      const config=await getJson('./channels.json',8000);
      state.names=[...new Set((config.streamers||[]).map(x=>String(x).toLowerCase()).filter(allowedName))];
      if(!state.names.length)throw Error('Kanal listesi boş');
      state.sponsor=String(config.sponsor||'keempiu');
    }catch(e){$('#loading').hidden=true;$('#data-status').textContent='channels.json yüklenemedi: '+e.message;return;}
    const list=$('#streamer-list');const frag=document.createDocumentFragment();
    for(const name of state.names){state.records.set(name,basic(name));frag.append(makeCard(name));}
    list.append(frag);applyFilters();
    await refresh();
  }
  document.addEventListener('DOMContentLoaded',init);
  // Small, testable API for offline local tests, not a public browser API.
  window.__gtaTest={directRecord,truthDate,openPlayer,closePlayer,state,refresh};
})();
