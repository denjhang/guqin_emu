# -*- coding: utf-8 -*-
"""
从 MusicXML 提取旋律统计特征：
  - 音程转移矩阵（半音差 -12~+12）
  - 节奏型分布（type+dots）
  - 调式分布（key fifths）
  - 乐句/小节长度分布
输出 JSON，供 H5 生成器作为旋律先验。
用法:
  python scripts/extract_melody_stats.py --folk "D:/我的文件/Downloads/Anthology-of-Chinese-Folk-Songs-main.zip" \
      --guqin "site/h5/scores/Guqin-Dataset-master" \
      --out site/h5/data
"""
import argparse
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

STEP2SEMI = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
RHYTHM_ORDER = ['whole', 'half', 'quarter', 'eighth', 'sixteenth', 'thirty-second']


def note_to_midi(note):
    """note element -> midi number 或 None（休止符）"""
    pitch = note.find('pitch')
    if pitch is None:
        return None
    step = pitch.findtext('step')
    octave = pitch.findtext('octave')
    alter = pitch.findtext('alter')
    if not step or not octave:
        return None
    midi = STEP2SEMI.get(step, 0) + (int(octave) + 1) * 12
    if alter:
        midi += int(alter)
    return midi


def rhythm_key(note):
    """节奏类型键：type + dots 数"""
    t = note.findtext('type') or 'quarter'
    dots = len(note.findall('dot'))
    return f"{t}.{dots}"


def parse_musicxml(xml_bytes):
    """解析单个 musicxml，返回 (midis, rhythms, fifths_list, measure_counts)"""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return None
    midis = []
    rhythms = []
    fifths_list = []
    measure_counts = []
    for part in root.findall('.//part'):
        for measure in part.findall('measure'):
            # 调号
            fifths = measure.findtext('.//fifths')
            if fifths is not None:
                fifths_list.append(int(fifths))
            notes_in_measure = 0
            for note in measure.findall('note'):
                # 跳过和弦的叠加音（只取旋律主线）
                if note.find('chord') is not None:
                    continue
                midi = note_to_midi(note)
                if midi is not None:
                    midis.append(midi)
                    notes_in_measure += 1
                rhythms.append(rhythm_key(note))
            measure_counts.append(notes_in_measure)
    return midis, rhythms, fifths_list, measure_counts


def interval_matrix(midis, half_range=12):
    """音程转移矩阵：从 midi[i] 到 midi[i+1] 的半音差分布"""
    m = Counter()
    for i in range(len(midis) - 1):
        diff = midis[i + 1] - midis[i]
        if -half_range <= diff <= half_range:
            m[diff] += 1
    return m


def build_stats(all_midis, all_rhythms, all_fifths, all_measure_counts):
    # 音程转移
    intervals = interval_matrix([m for seq in all_midis for m in seq])
    # 转为有序 dict（-12..+12）
    interval_dict = {str(k): intervals.get(k, 0) for k in range(-12, 13)}
    # 节奏型分布
    rhythm_dist = Counter(all_rhythms)
    # 调式分布
    key_dist = Counter(all_fifths)
    key_dict = {str(k): key_dist.get(k, 0) for k in range(-7, 8)}
    # 每小节音符数分布
    meas_dist = Counter(all_measure_counts)
    meas_dict = {str(k): meas_dist.get(k, 0) for k in range(0, 33)}
    # 乐句长度（连续有音符的小节数）
    phrase_lens = []
    cur = 0
    for c in all_measure_counts:
        if c > 0:
            cur += 1
        else:
            if cur > 0:
                phrase_lens.append(cur)
            cur = 0
    if cur > 0:
        phrase_lens.append(cur)
    phrase_dist = Counter(phrase_lens)
    phrase_dict = {str(k): phrase_dist.get(k, 0) for k in range(1, 33)}
    # 音域
    all_pitches = [m for seq in all_midis for m in seq]
    stats = {
        'song_count': len(all_midis),
        'note_count': len(all_pitches),
        'pitch_min': min(all_pitches) if all_pitches else 0,
        'pitch_max': max(all_pitches) if all_pitches else 0,
        'pitch_mean': round(sum(all_pitches) / len(all_pitches), 2) if all_pitches else 0,
        'interval_transition': interval_dict,
        'rhythm_distribution': dict(rhythm_dist.most_common(30)),
        'key_distribution': key_dict,
        'measure_note_count': meas_dict,
        'phrase_length': phrase_dict,
    }
    return stats


def process_folk_zip(zip_path):
    all_midis, all_rhythms, all_fifths, all_meas = [], [], [], []
    with zipfile.ZipFile(zip_path) as z:
        names = [n for n in z.namelist() if n.endswith('.musicxml')]
        print(f'[folk] 找到 {len(names)} 个 musicxml', flush=True)
        for i, name in enumerate(names):
            try:
                data = z.read(name)
                res = parse_musicxml(data)
                if res is None:
                    continue
                midis, rhythms, fifths, meas = res
                if midis:
                    all_midis.append(midis)
                    all_rhythms.extend(rhythms)
                    all_fifths.extend(fifths)
                    all_meas.extend(meas)
            except Exception as e:
                pass
            if (i + 1) % 2000 == 0:
                print(f'[folk] 已处理 {i+1}/{len(names)}', flush=True)
    return build_stats(all_midis, all_rhythms, all_fifths, all_meas)


def process_guqin_dir(root):
    all_midis, all_rhythms, all_fifths, all_meas = [], [], [], []
    files = []
    for dirpath, _, fnames in os.walk(root):
        for fn in fnames:
            if fn.endswith('.xml') or fn.endswith('.musicxml'):
                files.append(os.path.join(dirpath, fn))
    print(f'[guqin] 找到 {len(files)} 个 musicxml', flush=True)
    for i, fpath in enumerate(files):
        try:
            with open(fpath, 'rb') as f:
                data = f.read()
            res = parse_musicxml(data)
            if res is None:
                continue
            midis, rhythms, fifths, meas = res
            if midis:
                all_midis.append(midis)
                all_rhythms.extend(rhythms)
                all_fifths.extend(fifths)
                all_meas.extend(meas)
        except Exception:
            pass
        if (i + 1) % 100 == 0:
            print(f'[guqin] 已处理 {i+1}/{len(files)}', flush=True)
    return build_stats(all_midis, all_rhythms, all_fifths, all_meas)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--folk', help='民歌集 zip 路径')
    ap.add_argument('--guqin', help='古琴曲谱目录')
    ap.add_argument('--out', default='site/h5/data', help='输出目录')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    if args.folk:
        stats = process_folk_zip(args.folk)
        path = os.path.join(args.out, 'folk_melody_stats.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        print(f'[folk] 已保存 {path}  歌曲={stats["song_count"]} 音符={stats["note_count"]}', flush=True)
    if args.guqin:
        stats = process_guqin_dir(args.guqin)
        path = os.path.join(args.out, 'guqin_melody_stats.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        print(f'[guqin] 已保存 {path}  歌曲={stats["song_count"]} 音符={stats["note_count"]}', flush=True)


if __name__ == '__main__':
    main()
