// server/src/server.js
// Server entry point

const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 5000;
const { app } = createApp();

app.listen(PORT, () => {
  console.log(`AI-Personalized-Learning API running on http://localhost:${PORT}`);
});

