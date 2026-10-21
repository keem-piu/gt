"""Publish only runtime files, excluding source copies and credentials."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parent
out=root/'_site'
if out.exists(): shutil.rmtree(out)
(out/'data').mkdir(parents=True)
for name in ('index.html','app.js','channels.json','.nojekyll'):
    shutil.copy2(root/name,out/name)
shutil.copy2(root/'data/streamers.json',out/'data/streamers.json')
print('Published allowlist only:', sorted(str(x.relative_to(out)) for x in out.rglob('*') if x.is_file()))
