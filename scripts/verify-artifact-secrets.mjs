import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const [artifactDirectory, ...secretNames] = process.argv.slice(2);

if (!artifactDirectory || secretNames.length === 0) {
  throw new Error("Usage: verify-artifact-secrets.mjs <directory> <SECRET_NAME...>");
}

const root = resolve(artifactDirectory);
const files = [];

async function collectFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(path);
    if (entry.isFile()) files.push(path);
  }
}

function representations(value) {
  return [
    value,
    encodeURIComponent(value),
    encodeURIComponent(value).toLowerCase(),
    Buffer.from(value, "utf8").toString("base64"),
    Buffer.from(value, "utf8").toString("base64url"),
  ].filter((candidate, index, values) =>
    candidate.length >= 4 && values.indexOf(candidate) === index,
  );
}

const secrets = secretNames.map((name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Required Actions secret ${name} is missing.`);
  return { name, representations: representations(value) };
});

await collectFiles(root);

for (const path of files) {
  const content = await readFile(path);
  for (const secret of secrets) {
    for (const representation of secret.representations) {
      if (content.includes(Buffer.from(representation, "utf8"))) {
        throw new Error(
          `Deployment blocked: ${secret.name} was found in ${relative(root, path)}.`,
        );
      }
    }
  }
}

const menuPath = join(root, "menu.json");
const menu = JSON.parse(await readFile(menuPath, "utf8"));
if (menu.sample !== false || !Array.isArray(menu.days) || menu.days.length === 0) {
  throw new Error("Deployment blocked: the generated menu artifact is not live sanitized data.");
}

console.log(`Verified ${files.length} publishable files: no Actions secret is present.`);
