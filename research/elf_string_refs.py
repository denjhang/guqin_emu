"""
Direct ELF analysis of libapp.so:
  - locate target string literals in raw bytes (file offset)
  - scan whole file for u32 values pointing near each string
  - for each ref, dump ±32 bytes context and report whether it sits in executable code
  - try all plausible ref forms: bare offset, offset|1, offset-base, etc.
Output: research/ghidra_jianzi/elf_refs.txt
"""
import os, struct, sys

LIBAPP = r"d:\working\vscode-projects\guqin_emu\apk\extracted\lib\arm64-v8a\libapp.so"
OUT    = r"d:\working\vscode-projects\guqin_emu\research\ghidra_jianzi\elf_refs.txt"
# Ghidra loads libapp.so at base 0x100000 (file_off + 0x100000 = image address)
BASE = 0x100000

with open(LIBAPP, "rb") as f:
    data = f.read()
print(f"libapp.so size: {len(data):,} bytes")

# ELF segment info: find executable segments to know which file offsets are code
# Parse ELF64 header
assert data[:4] == b"\x7fELF", "not ELF"
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
    p_memsz = struct.unpack_from("<Q", data, off+40)[0]
    if p_type == 1:  # PT_LOAD
        segs.append((p_offset, p_vaddr, p_filesz, p_memsz, p_flags))
print(f"PT_LOAD segments: {len(segs)}")
for s in segs:
    perm = ("R" if s[4]&4 else "-") + ("W" if s[4]&2 else "-") + ("X" if s[4]&1 else "-")
    print(f"  off=0x{s[0]:x} vaddr=0x{s[1]:x} filesz=0x{s[2]:x} memsz=0x{s[3]:x} perm={perm}")

def is_code(file_off):
    """is this file offset in an executable PT_LOAD segment?"""
    for (p_off, p_vaddr, p_filesz, p_memsz, p_flags) in segs:
        if p_off <= file_off < p_off + p_filesz:
            return (p_flags & 1) == 1, p_off, p_vaddr
    return False, 0, 0

def vaddr_to_file_off(va):
    for (p_off, p_vaddr, p_filesz, p_memsz, p_flags) in segs:
        if p_vaddr <= va < p_vaddr + p_filesz:
            return p_off + (va - p_vaddr)
    return None

# targets
targets = [
    b"JianziSemanticParser",
    b"ParsedJianziAction",
    b"GuqinPerformanceEngine",
    b"PlayableJianziGlyph",
    b"GuqinPositionResolver",
    b"GuqinPositionCandidate",
    b"PentatonicHuiResolver",
    b"GuqinSampleBank",
    b"GuqinSamplePlaybackEngine",
    b"GuqinSoloudAudioEngine",
    b"GuqinNoteEvent",
    b"GuqinScheduledMusicEvent",
    b"GuqinGesture",
    b"GuqinTechnique",
    b"GuqinAppRecorder",
    b"GuqinStage",
    b"GuqinSimulatorPage",
    b"GuqinTuning",
    b"HuiPitchTable",
    b"frequencyForHarmonicPosition",
    b"fromSanfenSunyi",
    b"jianzi_semantics.dart",
    b"performance_engine.dart",
    b"position_resolver.dart",
    b"sample_bank.dart",
    b"tuning.dart",
    b"openStringCarryTechnique",
    b"isOpenStringCarryTechnique",
    b"leftHandForOpenStringCarryTechnique",
    b"_inferHui",
    b"_inferCuoLeftHui",
]

# index all 4-byte windows for fast reverse lookup of u32 values
print("indexing u32 values (this may take ~30s)...")
from collections import defaultdict
u32_index = defaultdict(list)
for off in range(0, len(data) - 4, 4):
    v = struct.unpack_from("<I", data, off)[0]
    # only store offsets in code segments to keep memory bounded
    # actually store all — libapp is ~11MB = 2.75M u32 slots
    u32_index[v].append(off)
print(f"  indexed {len(data)//4:,} u32 slots, distinct values: {len(u32_index):,}")

with open(OUT, "w", encoding="utf-8") as w:
    w.write(f"libapp.so: {len(data):,} bytes, ELF base in Ghidra: 0x{BASE:x}\n")
    w.write(f"PT_LOAD segments:\n")
    for s in segs:
        perm = ("R" if s[4]&4 else "-") + ("W" if s[4]&2 else "-") + ("X" if s[4]&1 else "-")
        w.write(f"  off=0x{s[0]:x} vaddr=0x{s[1]:x} filesz=0x{s[2]:x} perm={perm}\n")
    w.write("\n")

    for kw in targets:
        # find all positions of this string in the file
        starts = []
        i = 0
        while True:
            j = data.find(kw, i)
            if j < 0: break
            starts.append(j)
            i = j + 1
        w.write(f"==== {kw.decode()} hits={len(starts)} ====\n")
        for s_off in starts:
            # vaddr (loaded) in Ghidra image
            s_img = s_off + BASE
            w.write(f"  string @ file=0x{s_off:x}  image=0x{s_img:x}\n")
            # try several forms of pool-reference:
            #   (a) bare u32 == s_img
            #   (b) u32 == s_img | 1   (Smi tag)
            #   (c) u32 == s_off
            #   (d) u32 == s_off | 1
            #   (e) u32 == s_img - 0x10 / -0x8 / -0x18  (header before)
            #   (f) u32 == (s_img - 0x10) | 1, etc.
            forms = []
            for base_off in [s_img, s_off, s_img - 0x8, s_img - 0x10, s_img - 0x18, s_img - 0x20]:
                for tag in [0, 1]:
                    forms.append((base_off | tag, base_off, tag))
            ref_total = 0
            for (val, base_off, tag) in forms:
                refs = u32_index.get(val, [])
                if not refs: continue
                w.write(f"    form val=0x{val:x} (base=0x{base_off:x} tag={tag}) refs={len(refs)}\n")
                ref_total += len(refs)
                for r in refs[:10]:  # first 10
                    code, p_off, p_vaddr = is_code(r)
                    r_img = r + BASE
                    loc_kind = "CODE" if code else "DATA"
                    w.write(f"      ref@ file=0x{r:x} image=0x{r_img:x} [{loc_kind}]\n")
            if ref_total == 0:
                w.write("    (no u32 refs in any tested form)\n")
        w.write("\n")

print("done ->", OUT)
