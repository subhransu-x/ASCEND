from pathlib import Path
js = Path('tmp_longlat_script.js').read_text(encoding='utf-8')
for i in range(len(js)-2):
    if js[i] == '\\' and js[i+1] == '\\' and js[i+2] == '"':
        start = max(0, i-20)
        end = min(len(js), i+20)
        print(i, js[start:end])
