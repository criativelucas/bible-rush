# Dev server: `python3 serve.py`, then open http://localhost:5173. Never caches, so edits show on reload.
# PUT saves the request body under shots/ or assets/ui/ (dev.shot() in the console uses it).
import http.server
import os

SAVE_DIRS = ('shots', os.path.join('assets', 'ui'))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_PUT(self):
        path = self.translate_path(self.path)
        if not any(path.startswith(os.path.join(os.getcwd(), d) + os.sep) for d in SAVE_DIRS):
            return self.send_error(403)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(self.rfile.read(int(self.headers['Content-Length'])))
        self.send_response(204)
        self.end_headers()


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128  # the default 5 resets connections when the game loads its models in parallel


http.server.test(HandlerClass=NoCache, ServerClass=Server, port=5173, bind="127.0.0.1")
