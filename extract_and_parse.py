from pathlib import Path
from acorn import parse
html = Path(r'c:\Users\subhr\Downloads\files (1)\longlat.html').read_text(encoding='utf-8')
start = html.find('<script>')
end = html.find('</script>', start)
js = html[start+8:end]
Path('tmp_longlat_script2.js').write_text(js, encoding='utf-8')
print('wrote tmp_longlat_script2.js')
try:
    parse(js, ecmaVersion=2024, sourceType='script')
    print('parse ok')
except Exception as e:
    print('parse failed', e)
