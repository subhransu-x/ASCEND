from pathlib import Path
js = Path('tmp_longlat_script.js').read_text(encoding='utf-8')
for i,ch in enumerate(js):
    if ch == '\\':
        print('index', i, 'context', repr(js[max(0,i-20):i+20]))
        break
print('done')
