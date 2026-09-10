// Ghidra headless script: map Dart AOT pool references for jianzi-semantics strings.
// Pass 1 data gathering:
//  - find identifier strings, try string-object header sizes, scan image for
//    tagged u32 refs (objStart|1), dump pool neighborhood hex
//  - scan executable code for LDR xN,[x27,#imm] and write CSV (site,imm)
// ASCII-only comments (javac GBK).
// @category Export

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.mem.MemoryBlock;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;

public class GhidraDartCarryScript extends GhidraScript {

    @Override
    public void run() throws Exception {
        String outDir = System.getenv("GHIDRA_EXPORT_DIR");
        if (outDir == null || outDir.isEmpty()) outDir = "ghidra_carry";
        File dir = new File(outDir);
        dir.mkdirs();
        PrintWriter log = new PrintWriter(new FileWriter(new File(dir, "carry_report.txt")));

        String[] names = {
            "openStringCarryTechnique",
            "isOpenStringCarryTechnique",
            "leftHandForOpenStringCarryTechnique",
            "score_music_parser.dart",
            "jianzi_semantics.dart"
        };
        int[] headers = { 8, 12, 16, 20, 24, 32 };

        for (String name : names) {
            String pat = toPattern(name.getBytes("UTF-8"));
            Address a = currentProgram.getMinAddress();
            Address max = currentProgram.getMaxAddress();
            while (a != null && a.compareTo(max) <= 0) {
                Address[] arr = findBytes(a, pat, (int)(max.getOffset() - a.getOffset() + 1), 0);
                if (arr == null || arr.length == 0) break;
                for (Address s : arr) {
                    log.println("STRING " + name + " data@" + s);
                    println("STRING " + name + " data@" + s);
                    for (int h : headers) {
                        long objStart = s.getOffset() - h;
                        int tagged = (int)(objStart | 1L);
                        // scan whole image for u32 == tagged
                        Address b = currentProgram.getMinAddress();
                        while (b != null && b.compareTo(max) <= 0) {
                            Address[] r = findBytes(b, u32Pattern(tagged), (int)(max.getOffset() - b.getOffset() + 1), 0);
                            if (r == null || r.length == 0) break;
                            for (Address ref : r) {
                                log.println("  REF hdr=" + h + " obj=0x" + Long.toHexString(objStart)
                                    + " ref@" + ref + " (fileOff=0x"
                                    + Long.toHexString(ref.getOffset() - 0x100000L) + ")");
                                dumpAround(log, ref, 48);
                            }
                            b = r[r.length - 1].add(4);
                        }
                    }
                }
                a = arr[arr.length - 1].add(1);
            }
        }
        log.close();

        // Pass: collect LDR xN,[x27,#imm] from executable blocks
        PrintWriter csv = new PrintWriter(new FileWriter(new File(dir, "ldr_x27.csv")));
        for (MemoryBlock blk : currentProgram.getMemory().getBlocks()) {
            if (!blk.isExecute()) continue;
            long start = blk.getStart().getOffset();
            long end = blk.getEnd().getOffset();
            for (long p = start; p + 4 <= end; p += 4) {
                int insn = currentProgram.getMemory().getInt(addr(p));
                // LDR (imm, unsigned offset) 64-bit: 0xF9400000 | imm12<<10 | Rn<<5 | Rt
                if ((insn & 0xFFC00000) == 0xF9400000 && ((insn >> 5) & 31) == 27) {
                    long imm = ((insn >> 10) & 0xFFF) * 8L;
                    int rt = insn & 31;
                    csv.println("0x" + Long.toHexString(p) + "," + imm + ",x" + rt);
                }
                // LDRSW/LDR 32-bit variant 0xB9400000 (ldr wN)
                if ((insn & 0xFFC00000) == 0xB9400000 && ((insn >> 5) & 31) == 27) {
                    long imm = ((insn >> 10) & 0xFFF) * 4L;
                    int rt = insn & 31;
                    csv.println("0x" + Long.toHexString(p) + ",w" + imm + ",w" + rt);
                }
            }
            println("scanned block " + blk.getName() + " 0x" + Long.toHexString(start) + "-0x" + Long.toHexString(end));
        }
        csv.close();
        println("done");
    }

    private Address addr(long v) throws Exception { return currentProgram.getAddressFactory().getDefaultAddressSpace().getAddress(v); }

    private void dumpAround(PrintWriter log, Address ref, int before) throws Exception {
        long base = ref.getOffset() - before;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < before * 2 + 16; i += 4) {
            if (i % 32 == 0) sb.append(String.format("%n    0x%x: ", base + i));
            sb.append(String.format("%08x ", currentProgram.getMemory().getInt(addr(base + i))));
        }
        log.println("    " + sb.toString());
    }

    private String u32Pattern(int v) {
        byte[] b = new byte[4];
        b[0] = (byte)(v & 0xff); b[1] = (byte)((v >> 8) & 0xff);
        b[2] = (byte)((v >> 16) & 0xff); b[3] = (byte)((v >> 24) & 0xff);
        return toPattern(b);
    }

    private String toPattern(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("\\x%02x", b & 0xff));
        return sb.toString();
    }
}
