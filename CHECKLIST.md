# Checklist Technologie Chmurowe

Projekt: wieloserwisowy backend krótkich wiadomości uruchamiany przez Docker Compose.

## Diagram architektury

```text
Host / Client
  |
  | HTTP :8080
  v
Nginx reverse proxy  [public + private networks]
  |
  v
API Gateway          [private network]
  |        |          |
  |        |          +--> worker-service
  |        |
  |        +------------> mongo-service  --> MongoDB  (mongo_data)
  |
  +---------------------> pg-service     --> PostgreSQL (postgres_data)
```

Ruch zewnętrzny przechodzi wyłącznie przez Nginx. Serwisy aplikacyjne i bazy danych nie publikują portów na hosta.

## Serwisy

| Serwis | Rola | Dostęp z hosta | Healthcheck |
| --- | --- | --- | --- |
| `nginx` | Reverse proxy | `localhost:${NGINX_PORT:-8080}` | `GET /health` przez proxy |
| `api-gateway` | Publiczne REST API i orkiestracja | brak, tylko przez Nginx | `GET /health` |
| `pg-service` | Logika relacyjna PostgreSQL | brak | `GET /health` |
| `mongo-service` | Logika dokumentowa MongoDB | brak | `GET /health` |
| `worker-service` | Pomocnicza kolejka/worker dla zdarzeń `user.created` | brak | `GET /health` |
| `postgres` | Relacyjna baza danych | brak | `pg_isready` |
| `mongo` | Dokumentowa baza danych | brak | authenticated `mongosh ping` |
| `adminer` | Narzędzie developerskie | `localhost:${ADMINER_PORT:-8081}` | tylko profil `tools` |

## Sieci

| Sieć | Typ | Przeznaczenie |
| --- | --- | --- |
| `public` | bridge | Ruch z hosta do `nginx`; opcjonalnie `adminer` w profilu `tools`. |
| `private` | bridge, `internal: true` | Komunikacja między Nginx, usługami aplikacyjnymi i bazami. |

## Volumes

| Volume | Montowanie | Cel |
| --- | --- | --- |
| `postgres_data` | `/var/lib/postgresql/data` | Trwałe dane PostgreSQL. |
| `mongo_data` | `/data/db` | Trwałe dane MongoDB. |

`docker compose down` nie usuwa danych. `docker compose down -v` usuwa named volumes i dane testowe.

## Secrets i env

Wymagane wartości należy ustawić w `.env` utworzonym z `.env.example`.

| Zmienna | Cel |
| --- | --- |
| `APP_IMAGE_TAG` | Tag obrazów aplikacyjnych, np. `1.0.0` albo SHA commita. |
| `POSTGRES_PASSWORD` | Źródło secret `postgres_password`. |
| `MONGO_INITDB_ROOT_PASSWORD` | Źródło secret `mongo_root_password`. |
| `POSTGRES_DB`, `POSTGRES_USER` | Niepoufna konfiguracja PostgreSQL. |
| `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_DATABASE` | Niepoufna konfiguracja MongoDB. |
| `NGINX_PORT`, `ADMINER_PORT` | Porty hosta dla reverse proxy i profilu tools. |

Secrets w Compose:

- `postgres_password` z `POSTGRES_PASSWORD`;
- `mongo_root_password` z `MONGO_INITDB_ROOT_PASSWORD`.

`DATABASE_URL` i `MONGO_URI` są składane wewnątrz kontenerów z wartości niepoufnych oraz `/run/secrets/...`.

## Uruchomienie

```bash
cp .env.example .env
# uzupełnij w .env hasła i opcjonalnie APP_IMAGE_TAG
docker compose up --build -d
```

Tryb narzędziowy:

```bash
docker compose --profile tools up -d adminer
```

Zatrzymanie bez usuwania danych:

```bash
docker compose down
```

Czyszczenie środowiska i danych:

```bash
docker compose down -v
```

## Sprawdzenie Compose

```bash
docker compose config --quiet
docker compose config --services
docker compose ps
```

Oczekiwane usługi w podstawowym profilu:

```text
postgres
pg-service
worker-service
mongo
mongo-service
api-gateway
nginx
```

Oczekiwany `docker compose ps` po starcie:

- wszystkie usługi mają status `running`/`healthy`;
- tylko `nginx` publikuje port `0.0.0.0:8080->80/tcp`;
- `postgres`, `mongo`, `api-gateway`, `pg-service`, `mongo-service`, `worker-service` nie mają host ports.

## Smoke tests

### 1. Health przez reverse proxy

```bash
curl -fsS http://localhost:8080/health
```

Oczekiwany wynik:

```json
{"status":"ok","service":"api-gateway"}
```

### 2. Dodanie i odczyt użytkownika

```bash
EMAIL="smoke-user-$(date +%s)@example.test"
curl -fsS -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"username\":\"smoke-user\"}" \
  -o /tmp/smoke-user.json

USER_ID="$(node -e 'process.stdout.write(require("/tmp/smoke-user.json").id)')"
curl -fsS "http://localhost:8080/users/${USER_ID}"
```

Oczekiwany wynik:

- `POST /users` zwraca `201 Created`;
- odpowiedź zawiera `id`, `email`, `username`, `createdAt`;
- `GET /users/${USER_ID}` zwraca ten sam rekord.

### 3. Dowód działania workera

```bash
docker compose logs --tail=20 worker-service
```

Oczekiwany wynik po `POST /users`:

```text
[worker] queued job type=user.created ...
[worker] processed job type=user.created ...
```

## Persistence smoke test

```bash
EMAIL="persistence-check-$(date +%s)@example.test"
curl -fsS -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"username\":\"persistence-check\"}" \
  -o /tmp/persistence-user.json

USER_ID="$(node -e 'process.stdout.write(require("/tmp/persistence-user.json").id)')"

docker compose down
docker compose up -d

curl -fsS "http://localhost:8080/users/${USER_ID}"
```

Oczekiwany wynik:

- rekord użytkownika jest dostępny po `docker compose down && docker compose up -d`;
- dane znikają dopiero po `docker compose down -v`.

## Tagowanie obrazów

```bash
APP_IMAGE_TAG=1.0.0 docker compose build
APP_IMAGE_TAG="$(git rev-parse --short HEAD)" docker compose build
```

Obrazy aplikacyjne:

- `short-msg-backend-api-gateway:${APP_IMAGE_TAG:-dev}`;
- `short-msg-backend-pg-service:${APP_IMAGE_TAG:-dev}`;
- `short-msg-backend-mongo-service:${APP_IMAGE_TAG:-dev}`;
- `short-msg-backend-worker-service:${APP_IMAGE_TAG:-dev}`.

## Dodatkowe ustawienia operacyjne

Projekt ma w `docker-compose.yml`:

- `cpus` i `mem_limit` dla głównych usług;
- rotację logów `json-file` z `max-size=10m` i `max-file=3`;
- `stop_grace_period`;
- graceful shutdown w serwisach Node;
- profil `tools` dla Adminera.
