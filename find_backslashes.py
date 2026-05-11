from pathlib import Path
js = Path('tmp_longlat_script.js').read_text(encoding='utf-8')
for i, ch in enumerate(js):
    if ch == '\\':
        start = max(0, i-20)
        end = min(len(js), i+20)
        print(i, repr(js[start:end]))
