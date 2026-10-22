// The standalone exhibit launcher serves embedded assets on loopback only.
package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"time"
)

//go:embed app
var assets embed.FS

func appHandler(files fs.FS) http.Handler {
	server := http.FileServer(http.FS(files))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
		w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
		w.Header().Set("Cross-Origin-Resource-Policy", "same-origin")
		w.Header().Set("Cache-Control", "no-store")
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		info, err := fs.Stat(files, name)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		if strings.HasSuffix(name, ".wasm") {
			w.Header().Set("Content-Type", "application/wasm")
		}
		server.ServeHTTP(w, r)
	})
}

func findBrowser() (string, error) {
	for _, base := range []string{os.Getenv("ProgramFiles"), os.Getenv("ProgramFiles(x86)"), os.Getenv("LOCALAPPDATA")} {
		if base == "" {
			continue
		}
		for _, relative := range []string{"Google/Chrome/Application/chrome.exe", "Microsoft/Edge/Application/msedge.exe"} {
			candidate := filepath.Join(base, filepath.FromSlash(relative))
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				return candidate, nil
			}
		}
	}
	for _, name := range []string{"chrome.exe", "msedge.exe"} {
		if candidate, err := exec.LookPath(name); err == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("Chrome または Microsoft Edge が見つかりません。どちらかをインストールしてから起動してください。")
}

func run() error {
	noBrowser := flag.Bool("no-browser", false, "serve without opening a browser (validation)")
	window := flag.Bool("window", false, "open a normal application window instead of kiosk mode")
	port := flag.Int("port", 8765, "loopback port; keep fixed to retain visitor settings")
	flag.Parse()
	var browser string
	var err error
	if !*noBrowser {
		browser, err = findBrowser()
		if err != nil {
			return err
		}
	}
	files, err := fs.Sub(assets, "app")
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp4", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		return fmt.Errorf("展示用のポートを開けません。すでに起動している展示版を閉じてください。\n%w", err)
	}
	server := &http.Server{Handler: appHandler(files), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()
	serving := make(chan error, 1)
	go func() { serving <- server.Serve(listener) }()
	url := "http://" + listener.Addr().String() + "/game.html?exhibit=1"
	fmt.Println(url)
	interrupted := make(chan os.Signal, 1)
	signal.Notify(interrupted, os.Interrupt)
	defer signal.Stop(interrupted)
	if *noBrowser {
		select {
		case <-interrupted:
			return nil
		case err := <-serving:
			return err
		}
	}
	config, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	profile := filepath.Join(config, "shogi-match-exhibit", "browser")
	if err = os.MkdirAll(profile, 0700); err != nil {
		return err
	}
	args := []string{"--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check", "--disable-background-mode"}
	if *window {
		args = append(args, "--app="+url)
	} else {
		args = append(args, "--kiosk", url)
	}
	command := exec.Command(browser, args...)
	if err = command.Start(); err != nil {
		return fmt.Errorf("ブラウザを起動できませんでした: %w", err)
	}
	closed := make(chan error, 1)
	go func() { closed <- command.Wait() }()
	select {
	case err := <-closed:
		return err
	case <-interrupted:
		_ = command.Process.Kill()
		<-closed
		return nil
	case err := <-serving:
		_ = command.Process.Kill()
		<-closed
		return err
	}
}

func main() {
	if err := run(); err != nil {
		showError(err.Error())
		os.Exit(1)
	}
}
