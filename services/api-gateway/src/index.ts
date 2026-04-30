import { createApp } from "./app";

const port = Number(process.env.API_GATEWAY_PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`api-gateway listening on port ${port}`);
});
