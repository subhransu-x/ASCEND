from pathlib import Path
js = Path('tmp_longlat_script.js').read_text(encoding='utf-8')
needle = 'b.innerHTML="<span class=\\"oltr\\">"'
idx = js.find(needle)
print('idx', idx)
if idx == -1:
    print('needle not found')
    print('sample', js[54000:54750])
else:
    print(js[idx:idx+100])
    print([hex(ord(c)) for c in js[idx:idx+100]])
