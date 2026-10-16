# Builds Ink Dojo: src/lib.js and src/game_*.js -> ../inkdojo.html (the game, served on the Pages site)
# and build/page.html (the same page without <html>/<head>, for publishing as a claude.ai Artifact).
# Never edit inkdojo.html by hand: edit src/ and run  python3 inkdojo/build.py
import os
D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, 'src')
lib = open(os.path.join(SRC, 'lib.js')).read().replace("if (typeof module !== 'undefined') module.exports = INK;\n", '')
game = ''.join(open(os.path.join(SRC, f'game_{k}.js')).read() for k in ['a', 'b', 'm', 'c', 'd', 'fx', 'e', 'f', 'q', 'g'])
head = """<title>Ink Dojo</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap">
<style>
/* One look: ink on paper, by night. The whole page is the game's canvas. */
:root { --night: #120f19; --paper: #efe6d0; color-scheme: dark; }
html, body { margin: 0; height: 100%; background: var(--night); color: var(--paper); overflow: hidden; overscroll-behavior: none; }
#game { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
#safe { position: fixed; visibility: hidden; pointer-events: none; padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px); }
/* the tilt button: invisible, over the circle the game draws by the paper (a real button, so iPhones accept its tap) */
#tiltBtn { position: fixed; z-index: 2; margin: 0; padding: 0; border: 0; border-radius: 50%; background: transparent; opacity: 0; touch-action: manipulation; -webkit-tap-highlight-color: transparent; cursor: pointer; }
</style>
<canvas id="game" aria-label="Ink Dojo: a calligraphy adventure, and a pad of paper to write your moves on"></canvas>
<div id="safe"></div>
<button id="tiltBtn" type="button" aria-label="Tilt to walk" hidden></button>
"""
page = head + '<script>\n' + lib + '</script>\n<script>\n' + game + '</script>\n'
os.makedirs(os.path.join(D, 'build'), exist_ok=True)
open(os.path.join(D, 'build', 'page.html'), 'w').write(page)
full = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">\n' + page.replace('</style>\n', '</style>\n</head>\n<body>\n', 1) + '</body>\n</html>\n'
open(os.path.join(D, '..', 'inkdojo.html'), 'w').write(full)
print('built inkdojo.html', len(full), 'bytes; Artifact page build/page.html', len(page))
