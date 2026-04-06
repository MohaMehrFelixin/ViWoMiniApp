package finnotech

import "strings"

// stringReader wraps strings.NewReader for convenience.
func stringReader(s string) *strings.Reader {
	return strings.NewReader(s)
}
