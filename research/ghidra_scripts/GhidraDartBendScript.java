// Ghidra headless script: locate and decompile bend-related functions
// (callers of fadeRelativePlaySpeed / setRelativePlaySpeed FFI lookup strings)
// Usage: analyzeHeadless ... -postScript GhidraDartBendScript.java
// @category Export
// Pattern follows libsmaf ExportDecompiledFunctions.java (proven on this machine).
// NOTE: ASCII-only comments (Windows javac default GBK breaks UTF-8 comments).

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionManager;
import ghidra.program.model.symbol.Reference;

import java.io.File;
import java.io.FileWriter;
import java.util.HashSet;
import java.util.Set;

public class GhidraDartBendScript extends GhidraScript {

    @Override
    public void run() throws Exception {
        String outDir = System.getenv("GHIDRA_EXPORT_DIR");
        if (outDir == null || outDir.isEmpty()) {
            outDir = "ghidra_bend";
        }
        File dir = new File(outDir);
        dir.mkdirs();

        FunctionManager fm = currentProgram.getFunctionManager();
        DecompInterface dm = new DecompInterface();
        dm.openProgram(currentProgram);

        String[] names = { "fadeRelativePlaySpeed", "setRelativePlaySpeed" };
        Set<String> done = new HashSet<>();
        int exported = 0;

        for (String name : names) {
            println("==== " + name + " ====");
            String pat = toPattern(name.getBytes("UTF-8"));
            Address a = currentProgram.getMinAddress();
            Address max = currentProgram.getMaxAddress();
            while (a != null && a.compareTo(max) <= 0) {
                ghidra.program.model.address.Address[] arr = findBytes(a, pat, (int) (max.getOffset() - a.getOffset() + 1), 0);
                if (arr == null || arr.length == 0) break;
                for (ghidra.program.model.address.Address saddr : arr) {
                processString(saddr, name, fm, dm, dir, done); }
                a = arr[arr.length - 1].add(1);
                if (a.compareTo(max) > 0) break;
                Reference[] refs = getReferencesTo(a);
                println("string@" + a + " refs=" + refs.length);
                for (Reference r : refs) {
                    Address from = r.getFromAddress();
                    Function f = fm.getFunctionContaining(from);
                    if (f == null) f = fm.getFunctions(from, true).next();
                    if (f == null) continue;
                    exported += dump(dm, dir, f, name, 0, done);
                    for (Function caller : f.getCallingFunctions(monitor)) {
                        exported += dump(dm, dir, caller, "caller_" + name, 1, done);
                    }
                }
                a = a.add(1);
            }
        }
        println("exported " + exported + " functions");
    }


    private void processString(Address saddr, String name, FunctionManager fm,
                               DecompInterface dm, File dir, java.util.Set<String> done) {
        try {
            Reference[] refs = getReferencesTo(saddr);
            println("string@" + saddr + " refs=" + refs.length);
            for (Reference r : refs) {
                Address from = r.getFromAddress();
                Function f = fm.getFunctionContaining(from);
                if (f == null) f = fm.getFunctions(from, true).next();
                if (f == null) continue;
                dump(dm, dir, f, name, 0, done);
                for (Function caller : f.getCallingFunctions(monitor)) {
                    dump(dm, dir, caller, "caller_" + name, 1, done);
                }
            }
        } catch (Exception e) {
            println("ERR processString: " + e);
        }
    }

    private int dump(DecompInterface dm, File dir, Function f, String tag, int depth, Set<String> done) {
        String key = f.getName() + "@" + f.getEntryPoint() + "#" + depth;
        if (!done.add(key)) return 0;
        try {
            DecompileResults results = dm.decompileFunction(f, 180, monitor);
            if (results.getDecompiledFunction() == null) {
                println("SKIP (no result): " + f.getName());
                return 0;
            }
            String cCode = results.getDecompiledFunction().getC();
            if (cCode == null || cCode.trim().isEmpty()) return 0;
            String safe = f.getName().replaceAll("[^A-Za-z0-9]", "_");
            File out = new File(dir, "d" + depth + "_" + tag + "_" + safe + "_" + f.getEntryPoint() + ".c");
            FileWriter w = new FileWriter(out);
            w.write("/* " + f.getName() + " entry=" + f.getEntryPoint() + " depth=" + depth + " */\n");
            w.write(cCode);
            w.close();
            println("ok " + f.getName() + " -> " + out.getName());
            return 1;
        } catch (Exception e) {
            println("ERR " + f.getName() + ": " + e);
            return 0;
        }
    }

    private String toPattern(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("\\x%02x", b & 0xff));
        return sb.toString();
    }
}
