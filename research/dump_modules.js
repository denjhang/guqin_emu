// One-shot: dump all modules frida can see, and any with 'soloud'/'flutter'/'lingling' in name
'use strict';
function dumpModules() {
  const mods = Process.enumerateModules();
  send({ev:'mod_count', n: mods.length});
  const hits = mods.filter(m => /soloud|flutter|lingling|app\.so|aubio/i.test(m.name));
  send({ev:'hits', list: hits.map(m => ({name:m.name, base:m.base.toString(), size:m.size, path:m.path}))});
  // sample first 30 module names
  send({ev:'first30', list: mods.slice(0, 30).map(m => m.name)});
  // also scan anonymous maps with executable permission that might be translated code
  try {
    const ranges = Process.enumerateRanges('r-x');
    const big = ranges.filter(r => r.size > 0x100000).slice(0, 20);
    send({ev:'big_rx', list: big.map(r => ({base:r.base.toString(), size:r.size, file: r.file ? r.file.path : null}))});
  } catch(e) { send({ev:'ranges_err', msg: ''+e}); }
}
dumpModules();
