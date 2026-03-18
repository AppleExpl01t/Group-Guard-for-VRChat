/**
 * OCI Object Storage adapter.
 *
 * All backup data flows through these four functions. The client is lazily
 * initialised on first use so startup doesn't fail if OCI credentials aren't
 * present yet (the first real call will throw instead, surfacing a clear error).
 */

import * as oci from 'oci-sdk';
import { Readable } from 'stream';
import { config } from '../config';

// ---------------------------------------------------------------------------
// Lazy-initialised singleton client
// ---------------------------------------------------------------------------

interface OciContext {
  client: oci.objectstorage.ObjectStorageClient;
  namespace: string;
}

let ctx: OciContext | null = null;

async function getCtx(): Promise<OciContext> {
  if (ctx) return ctx;

  const provider = new oci.common.ConfigFileAuthenticationDetailsProvider(
    config.ociConfigPath,
  );
  const client = new oci.objectstorage.ObjectStorageClient({
    authenticationDetailsProvider: provider,
  });

  // Resolve namespace once; allow override via env to avoid an extra round-trip
  let namespace = config.ociNamespace;
  if (!namespace) {
    const resp = await client.getNamespace({});
    namespace = resp.value;
  }

  ctx = { client, namespace };
  return ctx;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Write (upsert) an object. */
export async function put(objectName: string, data: string): Promise<void> {
  const { client, namespace } = await getCtx();
  const buf = Buffer.from(data, 'utf8');

  await client.putObject({
    namespaceName: namespace,
    bucketName: config.ociBucketName,
    objectName,
    putObjectBody: buf,
    contentLength: buf.byteLength,
    contentType: 'application/json; charset=utf-8',
  });
}

/** Read an object; returns `null` if it does not exist. */
export async function get(objectName: string): Promise<string | null> {
  const { client, namespace } = await getCtx();

  try {
    const resp = await client.getObject({
      namespaceName: namespace,
      bucketName: config.ociBucketName,
      objectName,
    });
    return streamToString(resp.value as Readable);
  } catch (err: unknown) {
    // OCI SDK surfaces HTTP 404 as an error with a numeric `statusCode`
    if (isOciNotFound(err)) return null;
    throw err;
  }
}

/**
 * List all object names that start with `prefix`.
 * Handles OCI pagination automatically.
 */
export async function list(prefix: string): Promise<string[]> {
  const { client, namespace } = await getCtx();
  const names: string[] = [];
  let nextStartWith: string | undefined;

  do {
    const resp = await client.listObjects({
      namespaceName: namespace,
      bucketName: config.ociBucketName,
      prefix,
      startWith: nextStartWith,
      limit: 1000,
    });

    for (const obj of resp.listObjects.objects ?? []) {
      if (obj.name) names.push(obj.name);
    }

    nextStartWith = resp.listObjects.nextStartWith ?? undefined;
  } while (nextStartWith);

  return names;
}

/** Delete an object (silently succeeds if it doesn't exist). */
export async function del(objectName: string): Promise<void> {
  const { client, namespace } = await getCtx();

  try {
    await client.deleteObject({
      namespaceName: namespace,
      bucketName: config.ociBucketName,
      objectName,
    });
  } catch (err: unknown) {
    if (isOciNotFound(err)) return; // already gone — treat as success
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function streamToString(stream: Readable): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

function isOciNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    (err as { statusCode: number }).statusCode === 404
  );
}
