import { readFileSync } from 'node:fs';
import { gateway } from './gateway.mjs';

const origin = process.env.MSPI_FRONT_ORIGIN || 'https://localhost:6443';
if (!/^https:\/\/localhost:[0-9]{1,5}$/.test(origin)) throw new Error('Origen local inválido.');
const tls = {
  pfx: readFileSync('/run/mspi/server.p12'),
  passphrase: readFileSync('/run/mspi/server-password.txt', 'utf8').trim(),
};
const server = gateway({ origin, tls, ca: readFileSync('/run/mspi/ca.crt') });
server.listen(8443, '0.0.0.0', () => console.log('MSPI frontend disponible en ' + origin));
