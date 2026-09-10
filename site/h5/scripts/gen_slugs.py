#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 data/score_slugs.json：每个 corpus/hallScores 谱 id → 拼音 slug。
slug 规则：
  - 中文 → 拼音（不带声调），连写；非中文字符保留
  - 同名谱追加 _2/_3 ... 后缀（保留原文件名后缀样式）
  - 全局唯一
"""
import json, os, re, sys
from pypinyin import lazy_pinyin, Style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALL_RAW = os.path.join(ROOT, 'scores', 'all_raw.json')
HALL    = os.path.join(ROOT, 'community', 'hall_scores.json')
OUT     = os.path.join(ROOT, 'data', 'score_slugs.json')

def to_slug(title):
    # 拆为中文段与非中文段；中文段用 lazy_pinyin 不带声调
    out = []
    buf = []
    def flush():
        if not buf: return
        s = ''.join(buf)
        out.append(''.join(lazy_pinyin(s, style=Style.NORMAL)))
        buf.clear()
    for ch in title:
        if '\u4e00' <= ch <= '\u9fff':
            buf.append(ch)
        else:
            flush()
            out.append(ch.lower() if ch.isalpha() else ch)
    flush()
    s = ''.join(out)
    # 清理：保留字母数字与连字符，其它替换为连字符
    s = re.sub(r'[^a-z0-9]+', '-', s, flags=re.I)
    s = s.strip('-').lower()
    return s or 'untitled'

def main():
    items = []  # {id, title}
    seen_titles = set()
    if os.path.exists(ALL_RAW):
        arr = json.load(open(ALL_RAW, encoding='utf-8'))
        for s in arr:
            sid = s.get('id'); title = s.get('title') or ''
            if sid and title:
                items.append({'id': sid, 'title': title})
                seen_titles.add(title)
    if os.path.exists(HALL):
        try:
            arr = json.load(open(HALL, encoding='utf-8'))
            for s in arr:
                sid = s.get('id'); title = s.get('title') or ''
                if sid and title and title not in seen_titles:
                    items.append({'id': sid, 'title': title})
        except Exception as e:
            print('hall_scores 读取失败:', e, file=sys.stderr)

    used = {}   # slug → count
    result = {}  # id → slug
    slug_to_id = {}
    for it in items:
        base = to_slug(it['title'])
        slug = base
        # 处理同名重复：标题里若已有 _N 后缀，保留以维持可读
        if slug in slug_to_id and slug_to_id[slug] != it['id']:
            n = 2
            while f'{base}-{n}' in slug_to_id:
                n += 1
            slug = f'{base}-{n}'
        result[it['id']] = slug
        slug_to_id[slug] = it['id']

    payload = {'byId': result, 'bySlug': slug_to_id}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f'生成 {len(result)} 条 slug → {OUT}')
    # 打印前 20 条预览
    for i, (sid, slug) in enumerate(list(result.items())[:20]):
        print(f'  {sid[:8]}.. → {slug}')

if __name__ == '__main__':
    main()
