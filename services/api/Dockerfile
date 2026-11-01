FROM golang:1.27.3-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=dev
ARG COMMIT=unknown
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${VERSION} -X main.commit=${COMMIT}" -o /api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /api /api
ENV MUYU_ADDR=:8080 \
    MUYU_DB_PATH=/srv/muyu-data/muyu.db \
    MUYU_ANALYTICS_DB_PATH=/srv/muyu-data/analytics.db \
    IMAGE_ROOT=/srv/muyu-images \
    GIN_MODE=release
EXPOSE 8080
ENTRYPOINT ["/api"]
