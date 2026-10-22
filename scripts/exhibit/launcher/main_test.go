package main

import (
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestExhibitServer(t *testing.T) {
	files := fstest.MapFS{"game.html": {Data: []byte("exhibit game")}, "index.html": {Data: []byte("home")}, "vendor/engine.wasm": {Data: []byte{0, 97, 115, 109}}}
	handler := appHandler(files)
	for _, tc := range []struct {
		method, path string
		status       int
	}{
		{"GET", "/game.html?exhibit=1", 200}, {"HEAD", "/vendor/engine.wasm", 200},
		{"GET", "/vendor/", 404}, {"GET", "/../go.mod", 404}, {"GET", "/%2e%2e/go.mod", 404}, {"POST", "/game.html", 405},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
			if w.Code != tc.status {
				t.Fatalf("status %d, want %d", w.Code, tc.status)
			}
			if w.Header().Get("Cross-Origin-Opener-Policy") != "same-origin" || w.Header().Get("Cross-Origin-Embedder-Policy") != "require-corp" {
				t.Fatal("missing WASM isolation headers")
			}
			if tc.path == "/vendor/engine.wasm" && (w.Body.Len() != 0 || !strings.HasPrefix(w.Header().Get("Content-Type"), "application/wasm")) {
				t.Fatal("invalid WASM HEAD response")
			}
		})
	}
}
