# Chat Backend

Backend serwisu wymiany krótkich wiadomości. Projekt jest przygotowany jako zestaw mikroserwisów Node.js/TypeScript uruchamianych przez Docker Compose.

## Serwisy

- `api-gateway` - publiczne REST API i komunikacja HTTP z serwisami domenowymi.
- `pg-service` - przyszła obsługa PostgreSQL, Prisma, Knex, `pg` oraz Sequelize.
- `mongo-service` - przyszła obsługa MongoDB native driver, Mongoose, wiadomości, zdarzeń aktywności i analityki.
- `postgres` - relacyjna baza metadanych.
- `mongo` - dokumentowa baza treści wiadomości i zdarzeń.

## Uruchomienie

```bash
cp .env.example .env
docker compose up --build
```

Komenda uruchamia kontenery `api-gateway`, `pg-service`, `mongo-service`, `postgres` oraz `mongo` bez dodatkowych kroków ręcznych.

Health endpointy:

- `GET http://localhost:3000/health`
- `GET http://localhost:3001/health`
- `GET http://localhost:3002/health`

## Format błędów

Każdy serwis zwraca błędy API bez stack trace w formacie:

```json
{
  "error": "Route not found",
  "code": "ROUTE_NOT_FOUND",
  "details": null
}
```

## Przepływ danych

Docelowo klient wysyła żądania do `api-gateway`. Gateway komunikuje się HTTP z `pg-service` dla metadanych PostgreSQL oraz z `mongo-service` dla treści wiadomości, indeksów i agregacji MongoDB.

## T2 Knex.js

`pg-service` używa Knex jako dodatkowego narzędzia obok Prisma:

- migracje Knex znajdują się w `services/pg-service/knex/migrations` i tworzą pomocniczy moduł `conversation_search_audit`;
- seedy domenowe znajdują się w `services/pg-service/knex/seeds` i dodają przykładowych użytkowników, konwersacje oraz członkostwa;
- `GET /conversations/search` buduje dynamiczne filtry przez Knex Query Builder, bez sklejania SQL stringów.

Komendy:

```bash
npm run knex:migrate --workspace @chat/pg-service
npm run knex:seed --workspace @chat/pg-service
```

Przykład:

```bash
curl "http://localhost:3001/conversations/search?type=group&title=study&limit=10"
```

## T1 pg

`pg-service` używa natywnego sterownika `pg` w module `src/db/pgPool.ts`. Pool jest singletonem i korzysta z `DATABASE_URL`.

Endpointy demonstracyjne:

- `GET /pg/users/by-email?email=raw@example.test`
- `POST /pg/users-raw`

Zapytania używają parametrów PostgreSQL (`$1`, `$2`). Błędy SQLSTATE są mapowane do formatu `{ error, code, details }`, np. duplikat email zwraca `409` i `PG_UNIQUE_VIOLATION`.

## T3 Sequelize v6

`pg-service` używa Sequelize v6 w osobnym module domenowym delivery/audit, poza podstawową logiką Prisma:

- modele `DeliveryReceipt` i `ConversationAuditLog` znajdują się w `services/pg-service/src/modules/sequelize`;
- tabele są tworzone przez migrację Knex `create_sequelize_delivery_audit_tables`;
- `POST /sequelize/receipts-with-audit` tworzy audit log i delivery receipt w managed transaction;
- `GET /sequelize/audit-logs/:conversationId` używa eager loading przez `include`;
- hooki domenowe ustawiają timestampy delivery/read i normalizują `action` do uppercase.

## T5 MongoDB Native Driver

`mongo-service` używa natywnego sterownika MongoDB:

- singleton `MongoClient` znajduje się w `services/mongo-service/src/db/mongoClient.ts`;
- połączenie jest zamykane przy `SIGINT` i `SIGTERM`;
- kolekcja `messages` przechowuje treść wiadomości oraz zagnieżdżone metadane załączników;
- indeksy `{ conversationId: 1, seq: 1 }`, `{ conversationId: 1, createdAt: -1 }`, `{ body: "text" }` i `{ authorId: 1, createdAt: -1 }` są tworzone przy starcie serwisu;
- endpointy `POST /messages`, `GET /messages/:id`, `GET /conversations/:conversationId/messages`, `GET /messages/search`, `PATCH /messages/:id`, `DELETE /messages/:id` używają operatorów MongoDB `$gt`, `$lt`, `$text`, `$in` i `$set`.

## T6 Mongoose

`mongo-service` używa Mongoose jako osobnego modułu domenowego, niezależnego od kolekcji `messages` obsługiwanej natywnym sterownikiem:

- schematy `ActivityEvent` i `MessageDraft` znajdują się w `services/mongo-service/src/models/mongoose`;
- `MessageDraft.attachments` jest tablicą subdokumentów z walidacją rozmiaru pliku;
- custom validators sprawdzają typ zdarzenia, treść draftu i rozmiar załączników;
- pre hooki ustawiają `updatedAt` dla draftów i `createdAt` dla zdarzeń aktywności;
- `MessageDraft.preview()` zwraca pierwsze 50 znaków treści;
- `ActivityEvent.findRecentForConversation(conversationId, limit)` zwraca ostatnie zdarzenia;
- `GET /drafts/:id/with-activity` używa `populate("lastActivityEvent")`.

## T7 Aggregation Pipeline

`mongo-service` udostępnia endpointy analityczne wykonywane w MongoDB przez Aggregation Pipeline:

- `GET /analytics/messages-per-day?conversationId=&from=&to=` zaczyna od `$match` po `conversationId` i `createdAt`, korzystając z indeksu `{ conversationId: 1, createdAt: -1 }`;
- `GET /analytics/messages-per-conversation?from=&to=` zaczyna od `$match` po `createdAt`, korzystając z indeksu `{ createdAt: -1 }`;
- pipeline używają `$match`, `$group`, `$project`, `$sort` oraz `$lookup`;
- `$lookup` łączy wyniki z kolekcją `activityevents`, aby zwrócić `lastActivityType`;
- agregacja jest wykonywana w bazie, bez pobierania wszystkich dokumentów do Node.js.
