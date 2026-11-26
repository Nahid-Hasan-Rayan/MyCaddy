// NHR: runs the four-phone simulation from the command line
import { fourPhones } from "./fourPhones";

fourPhones().then(
  (r) => {
    console.log(`events per phone: ${r.perPhone.join(", ")}; on relay: ${r.relayEvents}; lost: ${r.lost}`);
    process.exit(r.lost === 0 && r.relayEvents === 12 ? 0 : 1);
  },
  (e) => {
    console.error(e.message);
    process.exit(1);
  }
);
