import os
os.environ.setdefault("GHIDRA_INSTALL_DIR", r"D:\Program Files\ghidra_12.1_PUBLIC_20260513\ghidra_12.1_PUBLIC")
import pyghidra
pyghidra.start()

# 打开已全量分析的 guqin_reverse 项目里的程序
from ghidra.base.project import GhidraProject
proj = GhidraProject.openProject(r"C:\Users\Administrator\AppData\Local\Temp\ghidra_projects", "guqin_reverse", True)
prog = proj.openProgram("/", "libapp.so", False)

from ghidra.app.decompiler import DecompInterface
from ghidra.util.task import ConsoleTaskMonitor
fm = prog.getFunctionManager()
af = prog.getAddressFactory().getDefaultAddressSpace()
di = DecompInterface(); di.openProgram(prog)
monitor = ConsoleTaskMonitor()
OUT = r"D:\working\vscode-projects\guqin_emu\research\ghidra_bend"
os.makedirs(OUT, exist_ok=True)

# FFI 蹦床入口（(name→code) 配对表分析所得）
ENTRY = 0x4d692c
addr = af.getAddress(ENTRY)
f = fm.getFunctionAt(addr) or fm.getFunctionContaining(addr)
print("function at %#x:" % ENTRY, f)
if f is not None:
    res = di.decompileFunction(f, 180, monitor)
    if res.decompileCompleted():
        with open(os.path.join(OUT, "ffi_trampoline_fade.c"), "w") as w:
            w.write(res.getDecompiledFunction().getC())
        print("trampoline decompiled")
        # 调用者链：向下追 4 层
        frontier = [(f, 0)]
        seen = set()
        count = 0
        while frontier and count < 60:
            (fn, depth) = frontier.pop(0)
            if depth > 4: continue
            callers = fn.getCallingFunctions(monitor)
            for c in callers:
                if c.getEntryPoint() in seen: continue
                seen.add(c.getEntryPoint())
                r2 = di.decompileFunction(c, 120, monitor)
                if r2.decompileCompleted():
                    p = os.path.join(OUT, "chain_d%d_%s.c" % (depth, str(c.getEntryPoint())))
                    with open(p, "w") as w:
                        w.write(r2.getDecompiledFunction().getC())
                    count += 1
                    frontier.append((c, depth + 1))
        print("call-chain decompiled:", count)
proj.close()
print("PYGHIDRA CHAIN DONE")
