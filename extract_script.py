from pathlib import Path
html = Path(r'c:\Users\subhr\Downloads\files (1)\longlat.html').read_text(encoding='utf-8')
start = html.find('<script>')
end = html.find('</script>', start)
if start == -1 or end == -1:
    raise SystemExit('script tag not found')
js = html[start+8:end]
Path('tmp_longlat_script.js').write_text(js, encoding='utf-8')
print('extracted', len(js), 'chars')
