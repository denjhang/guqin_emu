import os
os.environ.setdefault("GHIDRA_INSTALL_DIR", r"D:\Program Files\ghidra_12.1_PUBLIC_20260513\ghidra_12.1_PUBLIC")
import pyghidra
pyghidra.start()
from ghidra.base.project import GhidraProject
proj = GhidraProject.openProject(r"C:\Users\Administrator\AppData\Local\Temp\ghidra_projects", "guqin_reverse", True)
prog = proj.openProgram("/", "libapp.so", False)

from ghidra.app.decompiler import DecompInterface
from ghidra.util.task import ConsoleTaskMonitor
fm = prog.getFunctionManager()
af = prog.getAddressFactory().getDefaultAddressSpace()
listing = prog.getListing()
di = DecompInterface(); di.openProgram(prog)
monitor = ConsoleTaskMonitor()
OUT = r"D:\working\vscode-projects\guqin_emu\research\ghidra_bend"
os.makedirs(OUT, exist_ok=True)

BASE = 0x100000
ENTRY = 0x4d692c + BASE   # FFI trampoline for fadeRelativePlaySpeed
addr = af.getAddress(ENTRY)
f = fm.getFunctionAt(addr) or fm.getFunctionContaining(addr)
print("at %#x func=%s" % (ENTRY, f))

if f is None:
    disassemble_cmd = None
    pass
    f = fm.getFunctionAt(addr) or fm.getFunctionContaining(addr)
    print("forced func=%s" % f)

if f is not None:
    res = di.decompileFunction(f, 180, monitor)
    if res.decompileCompleted():
        with open(os.path.join(OUT, "ffi_trampoline_fade.c"), "w") as w:
            w.write(res.getDecompiledFunction().getC())
        print("trampoline OK")
        # 追调用链 4 层
        frontier = [(f, 0)]
        seen = set()
        count = 0
        while frontier and count < 80:
            (fn, depth) = frontier.pop(0)
            if depth > 4:
                continue
            for c in fn.getCallingFunctions(monitor):
                ep = str(c.getEntryPoint())
                if ep in seen:
                    continue
                seen.add(ep)
                r2 = di.decompileFunction(c, 120, monitor)
                if r2.decompileCompleted():
                    p = os.path.join(OUT, "chain_d%d_%s.c" % (depth, ep))
                    with open(p, "w") as w:
                        w.write(r2.getDecompiledFunction().getC())
                    count += 1
                    frontier.append((c, depth + 1))
        print("chain files:", count)
else:
    # 打印入口附近的指令，人工判断
    iu = listing.getInstructionAt(addr)
    cur = iu
    for i in range(10):
        if cur is None:
            break
        print(cur.toString())
        cur = listing.getInstructionAfter(cur.getAddress())
proj.close()
print("DONE")
