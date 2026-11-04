// Loads the service's .env, then the repo-root general .env (DATABASE_URL
// comes from the app file; JWT_SECRET and Kafka from the root one). dotenv
// never overwrites a variable the first file already set, so the app .env
// wins — matching the ConfigModule's envFilePath order. Jest does not read
// .env files on its own.
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
