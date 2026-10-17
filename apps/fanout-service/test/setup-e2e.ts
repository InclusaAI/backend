// Loads the service's .env so e2e specs see PARTICIPANT_TOKEN_SECRET,
// KAFKA_BROKER and REDIS_URL. Jest does not read .env files on its own.
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
