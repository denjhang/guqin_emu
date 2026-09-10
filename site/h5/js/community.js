/* 社区模块：复刻 APK 琴友动态（登录快照数据 + 本地互动）
 * 数据源：community/*.json（Supabase 登录态快照），图片 community/img/ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  let posts = [], profiles = {}, comments = [], likes = [], follows = [];
  let myLikes = {};
  const LKEY = 'h5-community-likes-v1';

  async function boot() {
    const load = async f => { try { return await (await fetch('community/' + f)).json(); } catch (e) { return []; } };
    [posts, comments, likes, follows] = await Promise.all([load('posts.json'), load('comments.json'), load('likes.json'), load('follows.json')]);
    (await load('profiles.json')).forEach(p => { profiles[p.id] = p; });
    try { myLikes = JSON.parse(localStorage.getItem(LKEY) || '{}'); } catch (e) { myLikes = {}; }
    build();
  }

  function authorOf(post) {
    const p = profiles[post.user_id];
    return p ? p.nickname : '琴友';
  }
  function initials(n) { return (n || '琴')[0]; }

  function timeAgo(iso) {
    if (!iso) return '';
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 60) return m + ' 分钟前';
    if (m < 1440) return Math.floor(m / 60) + ' 小时前';
    return new Date(iso).toLocaleDateString('zh-CN');
  }

  function commentsOf(postId) {
    return comments.filter(c => c.post_id === postId).sort((a, b) => a.created_at < b.created_at ? -1 : 1);
  }

  function build() {
    const box = $('#feedList');
    if (!box) return;
    box.innerHTML = '';
    posts
      .filter(p => p.status === 'published')
      .sort((a, b) => (b.created_at || '') < (a.created_at || '') ? -1 : 1)
      .forEach(post => {
        const liked = !!myLikes[post.id];
        const art = document.createElement('article');
        art.className = 'feed-card';
        const imgs = (post.media_items || []).filter(m => m.type === 'image');
        const cs = commentsOf(post.id);
        art.innerHTML = `
          <div class="feed-head">
            <span class="avatar">${initials(authorOf(post))}</span>
            <div class="feed-meta">
              <b class="fnick"></b>
              <span class="ftime">${timeAgo(post.created_at)}</span>
            </div>
            <span class="fcat">${post.category || ''}</span>
          </div>
          <div class="feed-body"></div>
          ${imgs.length ? `<div class="feed-imgs">${imgs.map(m => `<img loading="lazy" src="community/img/${String(m.path).split('/').pop()}" alt="">`).join('')}</div>` : ''}
          <div class="feed-foot">
            <button class="fbtn like ${liked ? 'on' : ''}">${liked ? '♥' : '♡'} <span class="lc">${(post.like_count || 0) + (liked ? 1 : 0)}</span></button>
            <button class="fbtn cmt">💬 ${cs.length}</button>
            <button class="fbtn view">👁 ${post.view_count || 0}</button>
          </div>
          <div class="feed-comments" style="display:none"></div>`;
        art.querySelector('.fnick').textContent = authorOf(post);
        const body = art.querySelector('.feed-body');
        body.textContent = post.content || post.title || '';
        // 评论展开
        const cbox = art.querySelector('.feed-comments');
        art.querySelector('.cmt').addEventListener('click', () => {
          cbox.style.display = cbox.style.display === 'none' ? 'block' : 'none';
          if (cbox.dataset.rendered) return;
          cbox.dataset.rendered = '1';
          cs.forEach(c => {
            const div = document.createElement('div');
            div.className = 'fc-item';
            div.innerHTML = `<b class="fc-nick"></b><span class="fc-text"></span><span class="fc-like">♥ ${c.like_count || 0}</span>`;
            div.querySelector('.fc-nick').textContent = (profiles[c.user_id] || {}).nickname || '琴友';
            div.querySelector('.fc-text').textContent = c.content;
            cbox.appendChild(div);
          });
          if (!cs.length) cbox.innerHTML = '<div class="fc-item fc-empty">还没有评论</div>';
        });
        // 点赞（本地）
        art.querySelector('.like').addEventListener('click', e => {
          const b = e.currentTarget;
          myLikes[post.id] = !myLikes[post.id];
          if (!myLikes[post.id]) delete myLikes[post.id];
          localStorage.setItem(LKEY, JSON.stringify(myLikes));
          b.classList.toggle('on', !!myLikes[post.id]);
          b.firstChild.textContent = myLikes[post.id] ? '♥ ' : '♡ ';
          const lc = b.querySelector('.lc');
          lc.textContent = (post.like_count || 0) + (myLikes[post.id] ? 1 : 0);
        });
        box.appendChild(art);
      });
    const count = document.querySelectorAll('.feed-card').length;
    const stat = $('#feedCount');
    if (stat) stat.textContent = `琴友动态 · ${count} 条`;
  }

  window.GuqinCommunity = { boot };
})();
