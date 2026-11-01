package api

import (
	"context"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
)

func TestFullContract(t *testing.T) {
	// Generation currently selects only health; validate the unfiltered source
	// as well so errors in future migration routes cannot hide behind that filter.
	spec, err := openapi3.NewLoader().LoadFromFile("../../../../packages/api-contract/openapi.yaml")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Validate(context.Background()); err != nil {
		t.Fatal(err)
	}
}
