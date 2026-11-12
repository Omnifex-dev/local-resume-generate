import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

/**
 * Node's fetch tries each of a host's IPv4/IPv6 addresses for only 250 ms
 * ("happy eyeballs"). On networks without working IPv6 and with a slow route
 * (VPN, far-away exit), every attempt times out and fetch fails with ETIMEDOUT
 * even though curl and the browser connect fine. A longer per-address timeout
 * keeps the fast path on good networks and fixes the slow ones.
 */
setDefaultAutoSelectFamilyAttemptTimeout(2500);
