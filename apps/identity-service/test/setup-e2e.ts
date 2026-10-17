// Loads the service's .env so e2e specs see DATABASE_URL / JWT_SECRET.
// Jest does not read .env files on its own.
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
