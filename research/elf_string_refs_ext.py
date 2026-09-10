"""
Extended ELF string-ref analysis: try all plausible Dart object header sizes
(0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 56, 64) x tag bits (0, 1, 0x80, 0x83).
For each hit, dump the 64-byte context and look for nearby LDR x27 instructions
within +-2KB of the ref site (if ref is in code) — Dart pool load sites.
Output: elf_refs_ext.txt
"""
import os, struct
from collections import defaultdict

LIBAPP = r"d:\working\vscode-projects\guqin_emu\apk\extracted\lib\arm64-v8a\libapp.so"
OUT    = r"d:\working\vscode-projects\guqin_emu\research\ghidra_jianzi\elf_refs_ext.txt"
BASE = 0x100000  # Ghidra image base

with open(LIBAPP, "rb") as f:
    data = f.read()

# ELF64 PT_LOAD
e_phoff = struct.unpack_from("<Q", data, 0x20)[0]
e_phentsize = struct.unpack_from("<H", data, 0x36)[0]
e_phnum = struct.unpack_from("<H", data, 0x38)[0]
segs = []
for i in range(e_phnum):
    off = e_phoff + i * e_phentsize
    p_type = struct.unpack_from("<I", data, off)[0]
    p_flags = struct.unpack_from("<I", data, off+4)[0]
    p_offset = struct.unpack_from("<Q", data, off+8)[0]
    p_vaddr = struct.unpack_from("<Q", data, off+16)[0]
    p_filesz = struct.unpack_from("<Q", data, off+32)[0]
    if p_type == 1:
        segs.append((p_offset, p_vaddr, p_filesz, p_flags))

def seg_of(file_off):
    for (p_off, p_vaddr, p_filesz, p_flags) in segs:
        if p_off <= file_off < p_off + p_filesz:
            perm = ("R" if p_flags&4 else "-") + ("W" if p_flags&2 else "-") + ("X" if p_flags&1 else "-")
            return p_off, p_vaddr, perm
    return None, None, "??"

def is_code(file_off):
    o,v,p = seg_of(file_off)
    return p == "RW-" or p == "R-X" or "X" in p

# index all u32
print("indexing u32...")
u32_index = defaultdict(list)
for off in range(0, len(data) - 4, 4):
    v = struct.unpack_from("<I", data, off)[0]
    u32_index[v].append(off)
print(f"  {len(u32_index):,} distinct values")

targets = [
    b"JianziSemanticParser", b"ParsedJianziAction", b"GuqinPerformanceEngine",
    b"PlayableJianziGlyph", b"GuqinPositionResolver", b"GuqinPositionCandidate",
    b"PentatonicHuiResolver", b"GuqinSampleBank", b"GuqinSamplePlaybackEngine",
    b"GuqinSoloudAudioEngine", b"GuqinNoteEvent", b"GuqinScheduledMusicEvent",
    b"GuqinGesture", b"GuqinTechnique", b"GuqinAppRecorder", b"GuqinStage",
    b"GuqinSimulatorPage", b"GuqinTuning", b"HuiPitchTable",
    b"frequencyForHarmonicPosition", b"fromSanfenSunyi",
    b"jianzi_semantics.dart", b"performance_engine.dart",
    b"position_resolver.dart", b"sample_bank.dart", b"tuning.dart",
    b"openStringCarryTechnique", b"isOpenStringCarryTechnique",
    b"leftHandForOpenStringCarryTechnique", b"_inferHui", b"_inferCuoLeftHui",
]

HEADERS = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 112]
TAGS = [0, 1, 0x80, 0x83, 0xff, 0x100, 0x200, 0x400, 0x800]

with open(OUT, "w", encoding="utf-8") as w:
    w.write(f"libapp.so {len(data):,} bytes; base=0x{BASE:x}\n")
    w.write(f"Segments:\n")
    for s in segs:
        perm = ("R" if s[3]&4 else "-") + ("W" if s[3]&2 else "-") + ("X" if s[3]&1 else "-")
        w.write(f"  off=0x{s[0]:x} va=0x{s[1]:x} sz=0x{s[2]:x} perm={perm}\n")
    w.write("\n")

    for kw in targets:
        starts = []
        i = 0
        while True:
            j = data.find(kw, i)
            if j < 0: break
            starts.append(j)
            i = j + 1
        w.write(f"==== {kw.decode()} hits={len(starts)} ====\n")
        for s_off in starts:
            s_img = s_off + BASE
            w.write(f"  string @ file=0x{s_off:x} image=0x{s_img:x}\n")
            hit_count = 0
            seen_refs = set()
            # Try all (header, tag) combinations, for both file and image bases
            for h in HEADERS:
                for base_label, base_val in [("FILE", s_off), ("IMG", s_img)]:
                    obj_base = base_val - h
                    if obj_base < 0: continue
                    for t in TAGS:
                        val = obj_base | t
                        refs = u32_index.get(val, [])
                        if not refs: continue
                        # dedup refs by (val, r) to avoid reporting same ref twice
                        new_refs = [r for r in refs if (val, r) not in seen_refs]
                        if not new_refs: continue
                        seen_refs.update((val, r) for r in new_refs[:5])
                        w.write(f"    form base={base_label} hdr={h} tag=0x{t:x} val=0x{val:x} refs={len(new_refs)}\n")
                        for r in new_refs[:5]:
                            o, v, p = seg_of(r)
                            r_img = r + BASE
                            w.write(f"      ref@ file=0x{r:x} image=0x{r_img:x} [{p}]\n")
                            ctx_start = max(0, r - 32)
                            ctx_end = min(len(data), r + 36)
                            hexb = " ".join(f"{data[k]:02x}" for k in range(ctx_start, ctx_end))
                            w.write(f"        ctx: {hexb}\n")
                        hit_count += len(new_refs)
            if hit_count == 0:
                w.write("    (no refs found in any form)\n")
        w.write("\n")

print("done ->", OUT)
