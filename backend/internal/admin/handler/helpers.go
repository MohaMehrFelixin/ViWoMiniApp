package handler

import "time"

// timeNowUnixNano returns the current time in nanoseconds. Indirected so
// tests can swap it for deterministic IDs without depending on time.Now.
var timeNowUnixNano = func() int64 { return time.Now().UnixNano() }
