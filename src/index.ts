import "dotenv/config"
import container from "./container"
import MySqlConnection from "./infra/database/mysql/connection"
import Catalog from "./domain/Catalog";
import Price from "./domain/Price";

(async () => {
    // await container.get(MySqlConnection).inicialize();
    // container.get(Catalog).extract();
    container.get(Price).extract();
})();
