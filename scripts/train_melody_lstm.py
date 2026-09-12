# -*- coding: utf-8 -*-
"""
轻量音乐语言模型 LSTM 训练：
  - 输入：MIDI 音高序列（古琴曲谱 + 民歌）
  - 模型：Embedding(32) + LSTM(64) + Linear → 下一个音高概率
  - 导出权重 JSON，供 JS 端前向推理生成旋律
用法:
  python scripts/train_melody_lstm.py --folk "D:/.../Anthology-of-Chinese-Folk-Songs-main.zip" \
      --guqin "site/h5/scores/Guqin-Dataset-master" \
      --out site/h5/data/melody_lstm_weights.json
"""
import argparse
import json
import os
import random
import zipfile
import xml.etree.ElementTree as ET

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

STEP2SEMI = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
PAD, BOS, EOS = 0, 1, 2
VOCAB_OFFSET = 3  # PAD/BOS/EOS 占 0-2
PITCH_MIN, PITCH_MAX = 33, 105  # MIDI 范围
VOCAB_SIZE = PITCH_MAX - PITCH_MIN + 1 + VOCAB_OFFSET  # 73+3=76
SEQ_LEN = 64


def midi_to_token(m):
    if m < PITCH_MIN:
        m = PITCH_MIN
    if m > PITCH_MAX:
        m = PITCH_MAX
    return m - PITCH_MIN + VOCAB_OFFSET


def note_to_midi(note):
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


def parse_musicxml(xml_bytes):
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return None
    midis = []
    for part in root.findall('.//part'):
        for measure in part.findall('measure'):
            for note in measure.findall('note'):
                if note.find('chord') is not None:
                    continue
                m = note_to_midi(note)
                if m is not None:
                    midis.append(m)
    return midis


def load_folk(zip_path):
    seqs = []
    with zipfile.ZipFile(zip_path) as z:
        names = [n for n in z.namelist() if n.endswith('.musicxml')]
        for name in names:
            try:
                midis = parse_musicxml(z.read(name))
                if midis and len(midis) >= 8:
                    seqs.append(midis)
            except Exception:
                pass
    return seqs


def load_guqin(root):
    seqs = []
    for dirpath, _, fnames in os.walk(root):
        for fn in fnames:
            if fn.endswith('.xml') or fn.endswith('.musicxml'):
                try:
                    with open(os.path.join(dirpath, fn), 'rb') as f:
                        midis = parse_musicxml(f.read())
                    if midis and len(midis) >= 8:
                        seqs.append(midis)
                except Exception:
                    pass
    return seqs


class MelodyDataset(Dataset):
    def __init__(self, sequences, weights=None):
        self.seqs = sequences
        self.weights = weights or [1.0] * len(sequences)

    def __len__(self):
        return len(self.seqs)

    def __getitem__(self, idx):
        midis = self.seqs[idx]
        # 随机截取 SEQ_LEN+1 窗口
        if len(midis) > SEQ_LEN:
            start = random.randint(0, len(midis) - SEQ_LEN - 1)
            midis = midis[start:start + SEQ_LEN + 1]
        tokens = [BOS] + [midi_to_token(m) for m in midis] + [EOS]
        # 填充到 SEQ_LEN+2
        if len(tokens) < SEQ_LEN + 2:
            tokens = tokens + [PAD] * (SEQ_LEN + 2 - len(tokens))
        else:
            tokens = tokens[:SEQ_LEN + 2]
        x = torch.tensor(tokens[:-1], dtype=torch.long)
        y = torch.tensor(tokens[1:], dtype=torch.long)
        return x, y


class MelodyLSTM(nn.Module):
    def __init__(self, vocab=VOCAB_SIZE, emb=32, hidden=64):
        super().__init__()
        self.emb = nn.Embedding(vocab, emb)
        self.lstm = nn.LSTM(emb, hidden, num_layers=1, batch_first=True)
        self.out = nn.Linear(hidden, vocab)
        self.hidden = hidden

    def forward(self, x, hc=None):
        e = self.emb(x)
        out, hc = self.lstm(e, hc)
        logits = self.out(out)
        return logits, hc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--folk', required=True)
    ap.add_argument('--guqin', required=True)
    ap.add_argument('--out', default='site/h5/data/melody_lstm_weights.json')
    ap.add_argument('--epochs', type=int, default=15)
    ap.add_argument('--batch', type=int, default=128)
    ap.add_argument('--lr', type=float, default=1e-3)
    args = ap.parse_args()

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f'设备: {device}', flush=True)

    folk = load_folk(args.folk)
    guqin = load_guqin(args.guqin)
    print(f'民歌序列: {len(folk)}, 古琴序列: {len(guqin)}', flush=True)

    # 古琴权重 5x，平衡数据量差异
    all_seqs = folk + guqin * 5
    print(f'总训练序列(古琴x5): {len(all_seqs)}', flush=True)

    ds = MelodyDataset(all_seqs)
    dl = DataLoader(ds, batch_size=args.batch, shuffle=True, drop_last=True, num_workers=0)

    model = MelodyLSTM().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    crit = nn.CrossEntropyLoss(ignore_index=PAD)

    for epoch in range(args.epochs):
        model.train()
        total_loss = 0
        n = 0
        for x, y in dl:
            x, y = x.to(device), y.to(device)
            logits, _ = model(x)
            loss = crit(logits.reshape(-1, VOCAB_SIZE), y.reshape(-1))
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            total_loss += loss.item()
            n += 1
        print(f'Epoch {epoch+1}/{args.epochs}  loss={total_loss/n:.4f}', flush=True)

    # 导出权重为 JSON（numpy float32 -> list）
    model.eval()
    sd = model.state_dict()
    weights = {}
    for k, v in sd.items():
        w = v.detach().cpu().numpy()
        weights[k] = {
            'shape': list(w.shape),
            'data': w.astype(np.float32).flatten().tolist(),
        }
    meta = {
        'vocab_size': VOCAB_SIZE,
        'emb_dim': 32,
        'hidden': 64,
        'seq_len': SEQ_LEN,
        'pitch_min': PITCH_MIN,
        'pitch_max': PITCH_MAX,
        'pad': PAD, 'bos': BOS, 'eos': EOS,
    }
    out = {'meta': meta, 'weights': weights}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(out, f)
    size_kb = os.path.getsize(args.out) / 1024
    print(f'已导出权重: {args.out}  ({size_kb:.1f} KB)', flush=True)


if __name__ == '__main__':
    main()
