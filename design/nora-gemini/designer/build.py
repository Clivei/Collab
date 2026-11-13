#!/usr/bin/env python3
"""Bundle src/*.js + vendored three.js / OrbitControls / GSAP into ONE self-contained padel-designer.html.

    python3 build.py            # needs `npm i three@0.147.0 gsap` in a scratch dir (see VENDOR below)
The vendored libraries are cached in vendor/ so the build works offline afterwards."""
import os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, VEN = os.path.join(HERE, 'src'), os.path.join(HERE, 'vendor')
LIBS = [  # (cache name, path inside node_modules)
    ('three.min.js', 'three/build/three.min.js'),
    ('OrbitControls.js', 'three/examples/js/controls/OrbitControls.js'),
    ('gsap.min.js', 'gsap/dist/gsap.min.js'),
]
ORDER = ['mold_nora_gemini_data.js', 'util.js', 'molds.js', 'textures.js', 'engine.js', 'app.js']


def vendor():
    os.makedirs(VEN, exist_ok=True)
    missing = [n for n, _ in LIBS if not os.path.exists(os.path.join(VEN, n))]
    if not missing:
        return
    scratch = os.environ.get('NPM_SCRATCH') or os.path.join(HERE, '.npm')
    os.makedirs(scratch, exist_ok=True)
    if not os.path.exists(os.path.join(scratch, 'node_modules', 'three')):
        subprocess.check_call(['npm', 'init', '-y'], cwd=scratch, stdout=subprocess.DEVNULL)
        subprocess.check_call(['npm', 'i', 'three@0.147.0', 'gsap'], cwd=scratch)
    for name, rel in LIBS:
        shutil.copy(os.path.join(scratch, 'node_modules', rel), os.path.join(VEN, name))


def esc(js):
    return re.sub(r'</(script)', r'<\\/\1', js, flags=re.I)


def main():
    vendor()
    html = open(os.path.join(SRC, 'index.template.html'), encoding='utf-8').read()
    parts = []
    for n, _ in LIBS:
        parts.append('/* ===== vendor/%s ===== */\n' % n + open(os.path.join(VEN, n), encoding='utf-8').read())
    for n in ORDER:
        parts.append('/* ===== src/%s ===== */\n' % n + open(os.path.join(SRC, n), encoding='utf-8').read())
    blob = '\n'.join('<script>\n%s\n</script>' % esc(p) for p in parts)
    out = html.replace('<!--SCRIPTS-->', blob)
    path = os.path.join(HERE, 'padel-designer.html')
    open(path, 'w', encoding='utf-8').write(out)
    print('wrote', path, '%.0f KB' % (len(out.encode()) / 1024))


if __name__ == '__main__':
    main()
