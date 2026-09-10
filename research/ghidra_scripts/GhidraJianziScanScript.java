// One-shot frida-style standalone Java Ghidra script.
// Goal: extract identifier strings + immediate constants around a list of jianzipu-related
// string literals. We don't try to resolve pool refs (already failed in GhidraDartCarryScript);
// instead, we dump the literal pool byte context around each string for manual inspection,
// and also collect every LDR xN,[x27,#imm] within a small window after each string address
// (Dart often places string right before its first use site / pool slot).
// @category Export

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.DataIterator;
import ghidra.program.model.listing.Data;
import ghidra.program.model.mem.MemoryBlock;

import java.io.File;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.List;

public class GhidraJianziScanScript extends GhidraScript {

    @Override
    public void run() throws Exception {
        String outDir = System.getenv("GHIDRA_EXPORT_DIR");
        if (outDir == null || outDir.isEmpty()) outDir = "ghidra_jianzi";
        File dir = new File(outDir);
        dir.mkdirs();
        PrintWriter log = new PrintWriter(new File(dir, "jianzi_scan.txt"));

        // Expanded keyword list based on APK analysis doc
        String[] kws = {
            "JianziSemanticParser", "ParsedJianziAction", "GuqinPerformanceEngine",
            "PlayableJianziGlyph", "GuqinPositionResolver", "GuqinPositionCandidate",
            "PentatonicHuiResolver", "GuqinSampleBank", "GuqinSamplePlaybackEngine",
            "GuqinSoloudAudioEngine", "GuqinNoteEvent", "GuqinScheduledMusicEvent",
            "GuqinGesture", "GuqinTechnique", "GuqinAppRecorder", "GuqinStage",
            "GuqinSimulatorPage", "GuqinTuning", "HuiPitchTable", "GuqinTuningFromSanfenSunyi",
            "frequencyForHarmonicPosition", "fromSanfenSunyi", "standard",
            "jianzi_semantics.dart", "playback/services/", "guqin_simulator.dart",
            "performance_engine.dart", "position_resolver.dart", "sample_bank.dart",
            "playable_jianzi_glyph.dart", "note_event.dart", "tuning.dart",
            "openStringCarryTechnique", "isOpenStringCarryTechnique",
            "leftHandForOpenStringCarryTechnique", "_inferHui", "_inferCuoLeftHui"
        };

        long base = currentProgram.getMinAddress().getOffset();
        long max  = currentProgram.getMaxAddress().getOffset();
        log.println("image: 0x" + Long.toHexString(base) + " - 0x" + Long.toHexString(max));

        for (String kw : kws) {
            String pat = toPattern(kw.getBytes("UTF-8"));
            Address a = currentProgram.getMinAddress();
            Address maxA = currentProgram.getMaxAddress();
            int totalHits = 0;
            while (a != null && a.compareTo(maxA) <= 0) {
                Address[] arr = findBytes(a, pat, (int)(maxA.getOffset() - a.getOffset() + 1), 0);
                if (arr == null || arr.length == 0) break;
                for (Address s : arr) {
                    totalHits++;
                    log.println("STRING " + kw + " @ " + s + " (fileOff=0x" +
                        Long.toHexString(s.getOffset() - 0x100000L) + ")");
                    // dump 64 bytes before and 128 bytes after
                    dumpAround(log, s, 64, 128);
                }
                a = arr[arr.length - 1].add(1);
            }
            log.println("-- " + kw + " hits=" + totalHits);
        }

        // Also: enumerate every defined string data in .rodata / .data, filter by chinese-ish or
        // 'parser'/'player'/'engine' substrings — too many to list manually.
        log.println("\n=== filtered defined strings ===");
        DataIterator di = currentProgram.getListing().getDefinedData(true);
        int kept = 0;
        while (di.hasNext() && kept < 8000) {
            Data d = di.next();
            if (d == null || !d.hasStringValue()) continue;
            String val = d.getValue().toString();
            if (val.length() < 4 || val.length() > 200) continue;
            String lower = val.toLowerCase();
            if (lower.contains("jianzi") || lower.contains("guqin") ||
                lower.contains("playable") || lower.contains("parser") ||
                lower.contains("semantic") || lower.contains("resolver") ||
                lower.contains("engine") || lower.contains("technique") ||
                lower.contains("sample") || lower.contains("tuning") ||
                lower.contains("hui") || lower.contains("string_") ||
                lower.contains("dart") || lower.contains("audio")) {
                log.println("DEFSTR @ " + d.getAddress() + " : " + val);
                kept++;
            }
        }
        log.println("defined strings kept: " + kept);
        log.close();
        println("jianzi scan done");
    }

    private void dumpAround(PrintWriter log, Address center, int before, int after) throws Exception {
        long c = center.getOffset();
        long s = c - before;
        long e = c + after;
        StringBuilder sb = new StringBuilder();
        for (long p = s; p <= e; p += 16) {
            sb.append(String.format("    0x%08x: ", p));
            for (long q = p; q < p + 16 && q <= e; q++) {
                if (q < 0 || q > currentProgram.getMaxAddress().getOffset()) {
                    sb.append("-- ");
                    continue;
                }
                try {
                    byte b = currentProgram.getMemory().getByte(addr(q));
                    sb.append(String.format("%02x ", b & 0xff));
                } catch (Exception ex) { sb.append("-- "); }
            }
            // ascii column
            sb.append(" | ");
            for (long q = p; q < p + 16 && q <= e; q++) {
                try {
                    byte b = currentProgram.getMemory().getByte(addr(q));
                    int bi = b & 0xff;
                    sb.append((bi >= 0x20 && bi < 0x7f) ? (char)bi : '.');
                } catch (Exception ex) { sb.append('.'); }
            }
            sb.append('\n');
        }
        log.println(sb.toString());
    }

    private Address addr(long v) throws Exception {
        return currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(v);
    }

    private String toPattern(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("\\x%02x", b & 0xff));
        return sb.toString();
    }
}
