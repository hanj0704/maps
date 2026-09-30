"""Development server: exposes generated data only, never the repository."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
parser = argparse.ArgumentParser()
parser.add_argument('--host', default='127.0.0.1')
parser.add_argument('--port', default=8787, type=int)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1] / 'data'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(root), **kw)
    def list_directory(self, path):
        self.send_error(403)
        return None
print(f'Data only: http://{args.host}:{args.port}/seoul-forest-v1.json', flush=True)
ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
