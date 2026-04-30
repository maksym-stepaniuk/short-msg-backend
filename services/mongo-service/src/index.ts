import { createApp } from "./app";

const port = Number(process.env.MONGO_SERVICE_PORT ?? 3002);
const app = createApp();

app.listen(port, () => {
  console.log(`mongo-service listening on port ${port}`);
});
