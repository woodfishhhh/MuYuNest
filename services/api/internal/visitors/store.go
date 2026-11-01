package visitors

import (
	"context"
	"fmt"

	"github.com/woodfishhhh/MuYuNest/services/api/internal/db"
	"github.com/woodfishhhh/MuYuNest/services/api/internal/db/sqlgen"
)

type Store struct{ db *db.Store }

type Registration struct {
	Total   int64 `json:"total"`
	Counted bool  `json:"counted"`
}

func New(database *db.Store) *Store { return &Store{db: database} }

func (s *Store) Total(ctx context.Context) (int64, error) {
	return sqlgen.New(s.db.Read).VisitorTotal(ctx)
}

// Register accepts the already-hashed visitor identity from the HTTP boundary.
// Legacy counted browsers are recorded without incrementing the imported total.
func (s *Store) Register(ctx context.Context, digest string, alreadyCounted bool) (Registration, error) {
	tx, err := s.db.Write.BeginTx(ctx, nil)
	if err != nil {
		return Registration{}, err
	}
	defer tx.Rollback()
	queries := sqlgen.New(tx)
	changed, err := queries.RegisterVisitor(ctx, digest)
	if err != nil {
		return Registration{}, fmt.Errorf("register visitor: %w", err)
	}
	result := Registration{Counted: changed == 1 && !alreadyCounted}
	if result.Counted {
		err = queries.IncrementVisitorTotal(ctx)
		if err != nil {
			return Registration{}, fmt.Errorf("increment visitors: %w", err)
		}
	}
	result.Total, err = queries.VisitorTotal(ctx)
	if err != nil {
		return Registration{}, err
	}
	if err := tx.Commit(); err != nil {
		return Registration{}, err
	}
	return result, nil
}
