# Wymiana krótkich wiadomości — backend i przechowywanie

Backend czatu tekstowego z REST API, PostgreSQL dla trwałych metadanych oraz MongoDB dla pełnej treści wiadomości, metadanych załączników i agregacji.

Projekt jest zbudowany jako zestaw mikroserwisów Node.js/TypeScript uruchamianych przez Docker Compose.

## Technologie

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- Knex.js
- `pg`
- Sequelize v6
- MongoDB native driver
- Mongoose
- Docker Compose
- OpenAPI
- Jest + Supertest

## Architektura

- `api-gateway` — publiczne REST API, walidacja wejścia, orkiestracja operacji hybrydowej i komunikacja HTTP z serwisami domenowymi.
- `pg-service` — PostgreSQL, Prisma, Knex.js, natywny sterownik `pg` oraz Sequelize v6.
- `mongo-service` — MongoDB native driver, Mongoose, kolekcja `messages`, activity events, drafts i analytics.
- `worker-service` — pomocniczy worker HTTP z prostą kolejką w pamięci; API Gateway wysyła do niego zdarzenie po utworzeniu użytkownika.
- `postgres` — relacyjna baza metadanych: użytkownicy, konwersacje, członkostwa, wskaźniki wiadomości.
- `mongo` — dokumentowa baza treści wiadomości, załączników i danych analitycznych.

Podział odpowiedzialności:

- PostgreSQL przechowuje trwałe metadane i kolejność wiadomości: `users`, `conversations`, `conversation_members`, `message_pointers`.
- MongoDB przechowuje treść wiadomości, metadane załączników, indeksy tekstowe i dane do agregacji.
- API Gateway nie zapisuje bezpośrednio do baz — komunikuje się z `pg-service` i `mongo-service` przez HTTP.

## Diagram przepływu

```text
Client -> Nginx -> API Gateway -> pg-service     -> PostgreSQL
Client -> Nginx -> API Gateway -> mongo-service  -> MongoDB
Client -> Nginx -> API Gateway -> worker-service -> queued background jobs
```

Zapis wiadomości:

```text
Client
 -> API Gateway
 -> pg-service: validate membership + reserve seq
 -> mongo-service: insert message
 -> pg-service: create message_pointer + update lastMessageAt/lastSeq
 -> if PG fail: mongo-service delete message
```

## Uruchomienie

```bash
cp .env.example .env
# ustaw w .env własne wartości POSTGRES_PASSWORD i MONGO_INITDB_ROOT_PASSWORD
docker compose up --build
```

Komenda uruchamia kontenery `nginx`, `api-gateway`, `pg-service`, `mongo-service`, `worker-service`, `postgres` i `mongo` bez kroków ręcznych.

Ruch z hosta przechodzi wyłącznie przez reverse proxy Nginx. Usługi aplikacyjne i bazy danych działają tylko w prywatnej sieci Docker Compose.

Hasła baz danych są przekazywane przez Docker Compose secrets:

- `postgres_password` jest tworzony z wartości `POSTGRES_PASSWORD` z `.env`;
- `mongo_root_password` jest tworzony z wartości `MONGO_INITDB_ROOT_PASSWORD` z `.env`;
- `pg-service` i `mongo-service` budują connection stringi w czasie startu kontenera na podstawie sekretów z `/run/secrets`.

Health endpointy:

- `GET http://localhost:8080/health` — publicznie przez Nginx do API Gateway
- `GET http://api-gateway:3000/health` — API Gateway, tylko w sieci prywatnej Compose
- `GET http://pg-service:3001/health` — pg-service, tylko w sieci prywatnej Compose
- `GET http://mongo-service:3002/health` — mongo-service, tylko w sieci prywatnej Compose
- `GET http://worker-service:3003/health` — worker-service, tylko w sieci prywatnej Compose

Szybka weryfikacja workera:

```bash
EMAIL="worker-check-$(date +%s)@example.test"
curl -i -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"username\":\"worker-check\"}"

docker compose logs --tail=20 worker-service
```

Oczekiwany dowód działania:

- odpowiedź `POST /users` ma nagłówek `X-Worker-Job: queued`;
- log `worker-service` zawiera wpis podobny do `[worker] processed job type=user.created`.

Weryfikacja trwałości danych:

PostgreSQL i MongoDB używają named volumes `postgres_data` i `mongo_data`. Dane powinny przetrwać restart środowiska wykonany bez flagi `-v`.

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

Oczekiwany dowód działania:

- po `docker compose down && docker compose up -d` bez `-v` endpoint `GET /users/${USER_ID}` zwraca ten sam rekord;
- dopiero `docker compose down -v` usuwa named volumes i dane testowe.

Czyszczenie danych lokalnych:

```bash
docker compose down -v
```

## Zmienne środowiskowe

Zmienne są opisane w `.env.example`.

| Zmienna | Opis |
| --- | --- |
| `NODE_ENV` | Tryb uruchomienia aplikacji. |
| `API_GATEWAY_PORT` | Lokalny port `api-gateway`, domyślnie `3000`. |
| `PG_SERVICE_PORT` | Lokalny port `pg-service`, domyślnie `3001`. |
| `MONGO_SERVICE_PORT` | Lokalny port `mongo-service`, domyślnie `3002`. |
| `WORKER_SERVICE_PORT` | Port prywatnego `worker-service`, domyślnie `3003`. |
| `NGINX_PORT` | Publiczny port reverse proxy Nginx, domyślnie `8080`. |
| `PG_SERVICE_URL` | Adres HTTP `pg-service` używany przez gateway. |
| `MONGO_SERVICE_URL` | Adres HTTP `mongo-service` używany przez gateway. |
| `WORKER_SERVICE_URL` | Adres HTTP `worker-service` używany przez gateway. |
| `WORKER_REQUEST_TIMEOUT_MS` | Timeout wysyłki zdarzenia do workera. |
| `SERVICE_REQUEST_TIMEOUT_MS` | Timeout wywołań międzyserwisowych gateway. |
| `POSTGRES_DB` | Nazwa bazy PostgreSQL. |
| `POSTGRES_USER` | Użytkownik PostgreSQL. |
| `POSTGRES_PASSWORD` | Hasło PostgreSQL używane jako źródło secret `postgres_password`. |
| `POSTGRES_HOST` | Host PostgreSQL w sieci Docker. |
| `POSTGRES_PORT` | Port PostgreSQL. |
| `MONGO_INITDB_ROOT_USERNAME` | Użytkownik root MongoDB. |
| `MONGO_INITDB_ROOT_PASSWORD` | Hasło root MongoDB używane jako źródło secret `mongo_root_password`. |
| `MONGO_INITDB_DATABASE` | Nazwa bazy MongoDB. |
| `MONGO_HOST` | Host MongoDB w sieci Docker. |
| `MONGO_PORT` | Port MongoDB. |

`DATABASE_URL` i `MONGO_URI` nie muszą być wpisywane w `.env` dla Docker Compose. Są składane wewnątrz kontenerów aplikacyjnych z wartości niepoufnych oraz sekretów.

## Migracje i seedy

Migracje i inicjalizacja są wykonywane przez kontenery aplikacyjne w `docker compose up --build`.

- Prisma: `pg-service` uruchamia `prisma migrate deploy`, więc relacyjny model działa na czystej bazie.
- Knex migrations: `pg-service` uruchamia `knex migrate:latest` dla tabel pomocniczych, w tym modułu search audit i tabel Sequelize delivery/audit.
- Knex seeds: `pg-service` uruchamia `knex seed:run` dla przykładowych danych domenowych.
- MongoDB: `mongo-service` tworzy indeksy kolekcji `messages` przy starcie, m.in. `{ conversationId: 1, seq: 1 }`, indeks chronologiczny, tekstowy i idempotencyjny.

Ręczne komendy pomocnicze:

```bash
npm run prisma:deploy --workspace @chat/pg-service
npm run knex:migrate --workspace @chat/pg-service
npm run knex:seed --workspace @chat/pg-service
```

## Endpointy

Publiczne endpointy API Gateway:

### Health

- `GET /health`

### Users

- `POST /users`
- `GET /users/:id`
- `DELETE /users/:id`

### Conversations

- `POST /conversations`
- `GET /conversations/:id`
- `GET /users/:userId/conversations`
- `POST /conversations/:conversationId/members`
- `GET /conversations/:conversationId/members`

### Messages

- `POST /conversations/:conversationId/messages`
- `GET /conversations/:conversationId/messages?requesterId=&afterSeq=&beforeSeq=&limit=`
- `GET /conversations/:conversationId/messages/search?requesterId=&q=&limit=`

`GET /conversations/:conversationId/messages` i search akceptują też nagłówek `X-User-Id` zamiast `requesterId`.

### Analytics

- `GET /analytics/messages-per-day?conversationId=&from=&to=`
- `GET /analytics/messages-per-conversation?from=&to=`

Endpointy techniczne używane do spełnienia wymagań, wystawiane przez serwisy domenowe:

- `pg-service`: `GET /conversations/search`, `GET /pg/users/by-email`, `POST /pg/users-raw`, `POST /sequelize/receipts-with-audit`, `GET /sequelize/audit-logs/:conversationId`.
- `mongo-service`: `POST /messages`, `GET /messages/:id`, `PATCH /messages/:id`, `DELETE /messages/:id`, `POST /drafts`, `GET /drafts/:id/with-activity`, `POST /activity-events`, `GET /activity-events/recent/:conversationId`.

## OpenAPI

Publikowalna specyfikacja publicznego API Gateway znajduje się w `openapi.yaml`.

Specyfikacja opisuje endpointy publiczne gateway, przykładowe requesty/response i wspólny format błędów:

```json
{
  "error": "...",
  "code": "...",
  "details": {}
}
```

## Testy

Testy e2e/integracyjne używają `Jest` i `Supertest`, uderzają w publiczny `api-gateway` i korzystają z baz uruchomionych przez Docker Compose.

Uruchomienie:

```bash
docker compose up --build
npm run test
npm run test:e2e
```

`npm run test` uruchamia główny zestaw krytycznych testów. `npm run test:e2e` uruchamia ten sam zestaw jawnie jako e2e.

Dodatkowe smoke testy:

```bash
npm run test:e2e:hybrid-message
npm run test:e2e:domain-rules
npm run test:e2e:read-endpoints
```

Zakres testów obejmuje healthcheck, użytkowników, duplikat email, reguły grup i członkostwa, wysyłkę wiadomości, zapis dokumentu MongoDB i pointera PostgreSQL, odczyt z cursorami, kompensację operacji hybrydowej oraz endpoint analityczny `messages-per-day`.

## Polityka usuwania użytkownika

Usunięcie użytkownika jest realizowane jako soft delete przez pole `deletedAt`.

- Rekord użytkownika pozostaje w PostgreSQL.
- Historia wiadomości pozostaje w MongoDB.
- Członkostwa w konwersacjach mogą pozostać w `conversation_members`.
- Historyczne `message_pointers` nadal wskazują autora wiadomości.

## Bezpieczeństwo

- Publiczne endpointy `api-gateway` mają walidację requestów przez `Zod`; błędy walidacji zwracają `400 VALIDATION_ERROR`.
- SQL injection jest ograniczane przez Prisma, Knex Query Builder oraz parametryzowane zapytania natywnego `pg` (`$1`, `$2`) bez sklejania wartości użytkownika z SQL.
- NoSQL injection jest ograniczane przez walidację typów i dozwolonych pól wejściowych przed budowaniem filtrów MongoDB.
- Globalne error handlery w `api-gateway`, `pg-service` i `mongo-service` nie zwracają stack trace do klienta.
- Błędy PostgreSQL, Prisma, MongoDB i Mongoose są jawnie mapowane na HTTP, m.in. `PG_UNIQUE_VIOLATION`, `PRISMA_UNIQUE_CONSTRAINT`, `MONGO_DUPLICATE_KEY` i `MONGO_VALIDATION_ERROR`.
- Wysyłka i odczyt wiadomości wymagają kontroli członkostwa konwersacji; brak członkostwa zwraca `403 NOT_MEMBER`, a brak uprawnień admina `403 NOT_ADMIN`.
- Ryzyko niespójności PostgreSQL/MongoDB przy zapisie wiadomości jest ograniczane kompensacją: jeśli finalizacja pointera w PostgreSQL nie powiedzie się po zapisie MongoDB, gateway usuwa dokument wiadomości z MongoDB i próbuje anulować rezerwację `seq`.

## Reguły domenowe

- Konwersacja `direct` musi mieć dokładnie dwóch uczestników i nie pozwala na dodawanie kolejnych członków.
- Konwersacja `group` wymaga co najmniej jednego uczestnika; twórca zostaje administratorem.
- Członków do grupy może dodawać tylko admin; brak uprawnień zwraca `403 NOT_ADMIN`, a duplikat członkostwa `409`.
- Wiadomość może wysłać tylko członek konwersacji; brak członkostwa zwraca `403 NOT_MEMBER`.
- Treść wiadomości może być pusta tylko wtedy, gdy podano załączniki; maksymalna długość treści to 2000 znaków.
- Początkowy status dostarczenia wiadomości to `server_received`.
- Jeśli `clientMessageId` jest podany, MongoDB wymusza unikalność `{ conversationId, authorId, clientMessageId }` tylko dla dokumentów z tym polem. Duplikat zwraca `409 IDEMPOTENCY_CONFLICT`.

## Checklist wymagań

### T1 — sterownik `pg`

- Singleton pool: `services/pg-service/src/db/pgPool.ts`.
- Parametryzacja `$1`, `$2`: endpointy `GET /pg/users/by-email` i `POST /pg/users-raw` w `services/pg-service/src/routes/pgNative.ts`.
- Mapowanie kodów PostgreSQL: `services/pg-service/src/errors/pgErrors.ts` obsługuje `23505`, `23503`, `23514`, `22P02`.

### T2 — Knex.js

- Migracje: `services/pg-service/knex/migrations`.
- Minimum 2 migracje addytywne: `create_conversation_search_audit`, `add_conversation_search_audit_created_at_index`, plus migracja tabel Sequelize.
- Seedy domenowe: `services/pg-service/knex/seeds/001_domain_seed.js`.
- Dynamiczny `WHERE` bez sklejania SQL stringów: `GET /conversations/search` w `services/pg-service/src/routes/conversations.ts` używa Knex Query Builder.

### T3 — Sequelize v6

- Modele: `DeliveryReceipt` i `ConversationAuditLog` w `services/pg-service/src/modules/sequelize`.
- Walidacje: status, action, metadata i reguła `readAt` w modelach Sequelize.
- Relacje i `include`: `ConversationAuditLog.hasMany(DeliveryReceipt)`, endpoint `GET /sequelize/audit-logs/:conversationId`.
- Hooki domenowe: timestampy delivery/read i normalizacja `action` do uppercase.
- Managed transaction: `POST /sequelize/receipts-with-audit`.

### T4 — Prisma

- Modele relacyjne: `User`, `Conversation`, `ConversationMember`, `MessagePointer` w `services/pg-service/prisma/schema.prisma`.
- Migracje Prisma: `services/pg-service/prisma/migrations`.
- `prisma migrate deploy` działa na czystej bazie i jest uruchamiane w compose.
- CRUD przez PrismaClient: endpointy użytkowników, konwersacji, członków i finalizacji wiadomości w `pg-service`.
- `$queryRaw` tagged template: `GET /users/:userId/conversations` oraz rezerwacja `seq` z `SELECT ... FOR UPDATE`.

### T5 — MongoDB native driver

- Singleton `MongoClient`: `services/mongo-service/src/db/mongoClient.ts`.
- Zamknięcie połączenia przy `SIGINT`/`SIGTERM`: `services/mongo-service/src/index.ts`.
- Zasób domenowy native driverem: kolekcja `messages` w `services/mongo-service/src/routes/messages.ts` i `internalMessages.ts`.
- Operatory: `$gt`, `$lt`, `$text`, `$in`, `$set` w endpointach messages.
- Indeksy: `services/mongo-service/src/db/messagesCollection.ts` tworzy indeks `{ conversationId: 1, seq: 1 }`, indeks tekstowy `body`, indeksy chronologiczne i partial unique dla `clientMessageId`.

### T6 — Mongoose

- Schematy: `ActivityEvent` i `MessageDraft` w `services/mongo-service/src/models/mongoose`.
- Custom validators: typ activity event, body draftu i rozmiar załącznika.
- Subdokumenty: `MessageDraft.attachments`.
- Pre hooki: `updatedAt` dla draftów i `createdAt` dla activity events.
- Populate: `GET /drafts/:id/with-activity` używa `populate("lastActivityEvent")`.
- Methods/statics: `MessageDraft.preview()` i `ActivityEvent.findRecentForConversation()`.

### T7 — Aggregation Pipeline

- `GET /analytics/messages-per-day` agreguje liczbę wiadomości per dzień.
- `GET /analytics/messages-per-conversation` agreguje liczbę wiadomości per konwersacja.
- Pipeline zawierają `$match`, `$group`, `$project`, `$sort`.
- `$lookup` jest użyty w `messages-per-conversation` do kolekcji `activityevents`.
- Pierwszy `$match` korzysta z indeksów `createdAt` albo `conversationId + createdAt`.

### T8a — Konteneryzacja

- `docker-compose.yml` uruchamia `api-gateway`, `pg-service`, `mongo-service`, `postgres`, `mongo`.
- Każdy serwis Node ma multi-stage `Dockerfile`.
- Healthchecki są skonfigurowane dla baz i serwisów Node.
- `depends_on` używa `condition: service_healthy`.
- `.env.example` zawiera zmienne wymagane do uruchomienia.

### T8b — Mikroserwisy

- Są 3 serwisy Node w osobnych kontenerach: `api-gateway`, `pg-service`, `mongo-service`.
- Podział per silnik BD: `pg-service` dla PostgreSQL, `mongo-service` dla MongoDB.
- Komunikacja HTTP między gateway i serwisami domenowymi.
- API Gateway jest jedynym publicznym wejściem dla głównych endpointów REST.
- Migracje i seedy są uruchamiane w compose.

### T8c — Architektura hybrydowa

- Zapis wiadomości łączy MongoDB i PostgreSQL: dokument `messages` + `message_pointers` i `lastMessageAt/lastSeq`.
- Kompensacja: przy błędzie finalizacji PostgreSQL gateway usuwa zapisany dokument z MongoDB.
- Jednolity format błędów `{ error, code, details }` jest stosowany w każdym serwisie.

## Wymagania specyficzne projektu

- PostgreSQL: `users`, `conversations`, `conversation_members`, `message_pointers` są zdefiniowane w Prisma i migrowane przez `prisma migrate deploy`.
- MongoDB: kolekcja `messages` zawiera `conversationId`, `authorId`, `seq`, `body`, timestampy, `deliveryStatus`, `attachments` i opcjonalny `clientMessageId`.
- API conversations/messages: publiczne endpointy gateway obsługują tworzenie konwersacji, dodawanie członków, wysyłkę, listę, search i listę konwersacji użytkownika.
- `403` bez członkostwa: wysyłka i odczyt wiadomości sprawdzają członkostwo przez `pg-service`.
- Soft delete: `DELETE /users/:id` ustawia `deletedAt`, historia wiadomości zostaje.
- Idempotencja: `clientMessageId` ma partial unique index `{ conversationId, authorId, clientMessageId }`; duplikat zwraca `409 IDEMPOTENCY_CONFLICT`.
- Hybrydowy zapis wiadomości: `POST /conversations/:conversationId/messages` orkiestruje rezerwację `seq`, zapis MongoDB, finalizację PostgreSQL i kompensację.
