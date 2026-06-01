import { validateUrl } from 'url';

const url1 = "javascript:alert(1)";
try {
  const u = new URL(url1);
  console.log("protocol:", u.protocol, "hostname:", u.hostname);
} catch (e) {
  console.log("error:", e.message);
}
