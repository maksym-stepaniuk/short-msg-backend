import { createApp } from "./app";

const port = Number(process.env.PG_SERVICE_PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`pg-service listening on port ${port}`);
});
