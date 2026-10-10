import { X509Certificate, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import selfsigned from 'selfsigned';

export async function localCertificates(directory: string, addresses: string[]) {
  const read = async (name: string) => ({ key: await fs.readFile(path.join(directory, `${name}-key.pem`), 'utf8'), cert: await fs.readFile(path.join(directory, `${name}.pem`), 'utf8') });
  const write = async (name: string, value: { key: string; cert: string }) => {
    await fs.writeFile(path.join(directory, `${name}-key.pem`), value.key, { mode: 0o600 });
    await fs.writeFile(path.join(directory, `${name}.pem`), value.cert);
  };
  let ca: { key: string; cert: string } | undefined;
  try { ca = await read('root-ca'); } catch {
    // Preserve trust in the previous preview's self-signed CA when possible.
    try { ca = { key: await fs.readFile(path.join(directory, 'key.pem'), 'utf8'), cert: await fs.readFile(path.join(directory, 'cert.pem'), 'utf8') }; } catch {}
  }
  if (ca) {
    const certificate = new X509Certificate(ca.cert);
    if (!certificate.ca || Date.parse(certificate.validTo) < Date.now() + 30 * 86400000) ca = undefined;
  }
  if (!ca) {
    const generated = await selfsigned.generate([{ name: 'commonName', value: 'Micbridge Local CA' }], {
      keySize: 2048, algorithm: 'sha256', notBeforeDate: new Date(Date.now() - 86400000), notAfterDate: new Date(Date.now() + 3650 * 86400000),
      extensions: [{ name: 'basicConstraints', cA: true, pathLenConstraint: 0 }, { name: 'keyUsage', keyCertSign: true, cRLSign: true }]
    });
    ca = { key: generated.private, cert: generated.cert };
  }
  await write('root-ca', ca);
  let tls: { key: string; cert: string } | undefined;
  const root = new X509Certificate(ca.cert);
  try {
    tls = await read('server');
    const leaf = new X509Certificate(tls.cert);
    if (leaf.ca || !leaf.verify(root.publicKey) || addresses.some(ip => !leaf.checkIP(ip)) || Date.parse(leaf.validTo) < Date.now() + 7 * 86400000) tls = undefined;
  } catch {}
  if (!tls) {
    const generated = await selfsigned.generate([{ name: 'commonName', value: 'Micbridge desktop' }], {
      ca, keySize: 2048, algorithm: 'sha256', notBeforeDate: new Date(Date.now() - 86400000), notAfterDate: new Date(Math.min(Date.now() + 90 * 86400000, Date.parse(root.validTo))),
      extensions: [{ name: 'basicConstraints', cA: false }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true }, { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, ...['127.0.0.1', ...addresses].map(ip => ({ type: 7 as const, ip }))] }]
    });
    tls = { key: generated.private, cert: generated.cert };
    await write('server', tls);
  }
  return { tls, certificate: ca.cert, fingerprint: root.fingerprint256 };
}

export function certificateProfile(certificate: string) {
  const root = new X509Certificate(certificate);
  const id = createHash('sha256').update(root.raw).digest('hex').slice(0, 32);
  const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>PayloadType</key><string>Configuration</string><key>PayloadVersion</key><integer>1</integer><key>PayloadIdentifier</key><string>local.micbridge.trust.${id}</string><key>PayloadUUID</key><string>${uuid}</string><key>PayloadDisplayName</key><string>Micbridge local HTTPS</string><key>PayloadDescription</key><string>Trust this desktop's local certificate authority for Micbridge. Enable full trust in Certificate Trust Settings after installation.</string><key>PayloadContent</key><array><dict>
<key>PayloadType</key><string>com.apple.security.root</string><key>PayloadVersion</key><integer>1</integer><key>PayloadIdentifier</key><string>local.micbridge.ca.${id}</string><key>PayloadUUID</key><string>${uuid.slice(0, -1)}${uuid.endsWith('0') ? '1' : '0'}</string><key>PayloadDisplayName</key><string>Micbridge local certificate authority</string><key>PayloadContent</key><data>${root.raw.toString('base64')}</data>
</dict></array></dict></plist>`;
}
