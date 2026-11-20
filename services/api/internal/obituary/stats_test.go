package obituary

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
)

const sample = `{"install_id":"0123456789abcdef0123456789abcdef","version":"v1.2.3","os":"linux","arch":"amd64","language":"en","channel":"script"}`

func TestDecode(t *testing.T) {
	for _, bad := range []string{sample + "{}", strings.Replace(sample, `"os"`, `"OS"`, 1), strings.Replace(sample, `"linux"`, `"linux","os":"linux"`, 1), strings.Replace(sample, `"amd64"`, `123`, 1), strings.Replace(sample, `v1.2.3`, `custom-name`, 1), strings.Replace(sample, `"en"`, `"en-US"`, 1), strings.Replace(sample, `}`, `,"ip":"test"}`, 1)} {
		if _, e := Decode(strings.NewReader(bad)); e == nil {
			t.Fatalf("accepted %s", bad)
		}
	}
}

func TestActivityAndRetention(t *testing.T) {
	ctx := t.Context()
	store, e := db.Open(ctx, filepath.Join(t.TempDir(), "stats.db"), "obituary")
	if e != nil {
		t.Fatal(e)
	}
	defer store.Close()
	s := Stats{DB: store, Key: []byte("fixture-key")}
	now := time.Now().UTC()
	p, e := Decode(strings.NewReader(sample))
	if e != nil {
		t.Fatal(e)
	}
	_, e = store.Write.Exec(`UPDATE coverage SET first_day=?`, now.AddDate(0, 0, -40).Format(time.DateOnly))
	if e != nil {
		t.Fatal(e)
	}
	record := func(d int) {
		t.Helper()
		if e := s.Record(ctx, p, now.AddDate(0, 0, d)); e != nil {
			t.Fatal(e)
		}
	}
	record(-400)
	record(-399)
	record(-20)
	record(-2)
	p["version"] = "2.0.0"
	record(-2)
	mac := hmac.New(sha256.New, s.Key)
	mac.Write([]byte(p["install_id"]))
	var digest []byte
	var first, last string
	if e := store.Read.QueryRow(`SELECT digest,first_day,last_day FROM installs`).Scan(&digest, &first, &last); e != nil || !bytes.Equal(digest, mac.Sum(nil)) || first != now.AddDate(0, 0, -400).Format(time.DateOnly) || last != now.AddDate(0, 0, -2).Format(time.DateOnly) {
		t.Fatal("wrong lifetime identity", e)
	}
	p["install_id"] = strings.Repeat("a", 32)
	p["channel"] = "other"
	record(-10)
	record(0)
	if e := s.Prune(ctx, now); e != nil {
		t.Fatal(e)
	}
	var rows int
	if e := store.Read.QueryRow(`SELECT count(*) FROM activity`).Scan(&rows); e != nil || rows != 5 {
		t.Fatal(rows, e)
	}
	out, e := s.Summary(ctx, now)
	if e != nil {
		t.Fatal(e)
	}
	if out.Weekly != 1 || out.Monthly != 2 || out.Installs != 2 || len(out.Daily) != 90 || out.Daily[0].Count != nil || *out.Daily[88].Count != 1 || *out.Daily[89].Count != 0 || out.Channels["script"] != 5 || out.Channels["other"] != 2 || out.Distributions["version"]["2.0.0"] != 2 {
		t.Fatalf("wrong aggregation: %+v", out)
	}
}
