# -*- coding: utf-8 -*-
# Hook APK SoLoud 插件：loadFile/play/setRelativeSpeed/fadeRelativePlaySpeed
# 产出每音事件：采样身份（弦+类型）+ 变速比（=频率/采样基频）
import frida, sys, json, time, io

JS = """
'use strict';
function s(x) { send(x); }
const LIB = 'libflutter_soloud_plugin.so';
function cstr(p) { try { return p.readUtf8String(); } catch(e){ return '?'; } }
function attach(mod) {
  const names = {};
  mod.enumerateExports().forEach(e => names[e.name] = e.address);

  if (names['loadFile']) {
    Interceptor.attach(names['loadFile'], {
      onEnter(a) { this.uri = cstr(a[0]); },
      onLeave(r) { s({ev:'loadFile', uri:this.uri, hash: r.toInt32()>>>0}); }
    });
  }
  for (const fn of ['play','playClocked','playScheduled','playWithLoopPoints']) {
    if (names[fn]) Interceptor.attach(names[fn], {
      onEnter(a) { s({ev:fn, hash: a[0].toInt32()>>>0, vol:+a[1], pan:+a[2], loop:+a[3], looping:+a[4], t:+a[5]}); }
    });
  }
  if (names['setRelativeSpeed']) Interceptor.attach(names['setRelativeSpeed'], {
    onEnter(a) { s({ev:'setRelativeSpeed', handle:a[0].toInt32()>>>0, speed:+a[1], t:Date.now()}); }
  });
  if (names['fadeRelativePlaySpeed']) Interceptor.attach(names['fadeRelativePlaySpeed'], {
    onEnter(a) { s({ev:'fade', handle:a[0].toInt32()>>>0, to:+a[1], sec:+a[2], t:Date.now()}); }
  });
  s({ev:'attached', exports:Object.keys(names).length});
}
try {
  const mod = Process.findModuleByName(LIB);
  if (mod) attach(mod);
  else {
    s({ev:'waiting'});
    const iv = setInterval(() => {
      const m = Process.findModuleByName(LIB);
      if (m) { clearInterval(iv); attach(m); }
    }, 500);
  }
} catch (e) { s({ev:'err', msg:''+e}); }
"""

def main(out_path):
    dev = frida.get_usb_device(timeout=10)
    pid = None
    for p in dev.enumerate_processes():
        if 'guqindashi' in p.name or 'lingling' in p.name.lower():
            pid = p.pid; break
    if pid is None:
        pid = int(sys.argv[2]) if len(sys.argv) > 2 else 4976
    session = dev.attach(pid)
    script = session.create_script(JS)
    f = io.open(out_path, 'w', encoding='utf-8')
    def on_message(msg, data):
        if msg['type'] == 'send':
            f.write(json.dumps(msg['payload'], ensure_ascii=False) + '\n')
            f.flush()
        else:
            f.write(json.dumps({'ev':'error', 'msg':str(msg)}) + '\n'); f.flush()
    script.on('message', on_message)
    script.load()
    print('hooked, logging to', out_path, flush=True)
    import threading
    threading.Event().wait()

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'hook_events.jsonl')
