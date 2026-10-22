//go:build !windows

package main

import (
	"fmt"
	"os"
)

func showError(message string) { fmt.Fprintln(os.Stderr, message) }
