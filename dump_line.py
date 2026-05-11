from pathlib import Path
text = Path(r'c:\Users\subhr\Downloads\files (1)\longlat.html').read_text(encoding='utf-8')
for i, line in enumerate(text.splitlines(), 1):
    if 'b.innerHTML' in line:
        print('LINE', i)
        print(repr(line))
        break
