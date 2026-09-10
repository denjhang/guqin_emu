#!/bin/bash
# 从 audio_list.txt 批量下载音频到 site/guqin/
cd /d/working/vscode-projects/guqin_emu
ok=0; fail=0
while read -r p; do
  url="https://udywang.com/guqin/$p"
  dest="site/guqin/$p"
  [ -s "$dest" ] && { ok=$((ok+1)); continue; }
  mkdir -p "$(dirname "$dest")"
  code=$(curl -s -o "$dest" -w "%{http_code}" "$url")
  if [ "$code" = "200" ]; then ok=$((ok+1)); else fail=$((fail+1)); echo "FAIL $code $p"; fi
done < research/audio_list.txt
echo "done ok=$ok fail=$fail"
