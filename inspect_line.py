from pathlib import Path
js = Path('tmp_longlat_script.js').read_text(encoding='utf-8')
line_no = 122
lines = js.splitlines()
print('total lines', len(lines))
line = lines[line_no-1]
print(repr(line))
print('line len', len(line))
col = 117
print('column snippet', repr(line[col-5:col+5]))
print([ord(c) for c in line[col-5:col+5]])
