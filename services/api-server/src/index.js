const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const uploadRoutes = require("./routes/upload-routes");

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// Mount your routes
app.use("/api/upload", uploadRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server Started At PORT ${PORT}`);
});
