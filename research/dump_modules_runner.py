import frida, sys, json
dev = frida.get_usb_device(timeout=10)
pid = int(sys.argv[1]) if len(sys.argv) > 1 else 4114
session = dev.attach(pid)
with open('dump_modules.js', 'r', encoding='utf-8') as f:
    js = f.read()
script = session.create_script(js)
def on_message(msg, data):
    if msg['type'] == 'send':
        print(json.dumps(msg['payload'], ensure_ascii=False))
    else:
        print('ERR', msg)
script.on('message', on_message)
script.load()
import threading; threading.Event().wait(timeout=5)
session.detach()
