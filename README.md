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
