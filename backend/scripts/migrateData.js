/**
 * MongoDB Data Migration Script
 * Copies all collections from source DB to target DB
 *
 * Usage:
 *   node scripts/migrateData.js "<SOURCE_URI>" "<TARGET_URI>"
 *
 * Example:
 *   node scripts/migrateData.js \
 *     "mongodb://localhost:27017/EXE_dev" \
 *     "mongodb+srv://user:pass@cluster.mongodb.net/EXE_prod"
 *
 * Options:
 *   --drop   Drop each collection on target before inserting (full replace)
 *
 * Example with drop:
 *   node scripts/migrateData.js "mongodb://localhost:27017/EXE_dev" "mongodb+srv://..." --drop
 */

import { MongoClient } from "mongodb";

const [, , sourceUri, targetUri, ...flags] = process.argv;
const DROP_BEFORE_INSERT = flags.includes("--drop");

if (!sourceUri || !targetUri) {
  console.error(
    "Usage: node scripts/migrateData.js <SOURCE_URI> <TARGET_URI> [--drop]"
  );
  process.exit(1);
}

async function migrate() {
  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    console.log("Connecting to source database...");
    await sourceClient.connect();

    console.log("Connecting to target database...");
    await targetClient.connect();

    // Extract database name from URI (last path segment)
    const sourceDbName = new URL(sourceUri).pathname.replace(/^\//, "");
    const targetDbName = new URL(targetUri).pathname.replace(/^\//, "");

    if (!sourceDbName) {
      console.error("Source URI must include a database name (e.g. .../EXE_dev)");
      process.exit(1);
    }
    if (!targetDbName) {
      console.error("Target URI must include a database name (e.g. .../EXE_prod)");
      process.exit(1);
    }

    const sourceDb = sourceClient.db(sourceDbName);
    const targetDb = targetClient.db(targetDbName);

    // List all collections in source DB
    const collections = await sourceDb.listCollections().toArray();

    if (collections.length === 0) {
      console.warn("No collections found in source database.");
      return;
    }

    console.log(`\nFound ${collections.length} collections: ${collections.map((c) => c.name).join(", ")}\n`);

    for (const { name } of collections) {
      const sourceColl = sourceDb.collection(name);
      const targetColl = targetDb.collection(name);

      const docs = await sourceColl.find({}).toArray();

      if (docs.length === 0) {
        console.log(`  [${name}] — empty, skipping`);
        continue;
      }

      if (DROP_BEFORE_INSERT) {
        await targetColl.drop().catch(() => {}); // ignore error if collection doesn't exist yet
        console.log(`  [${name}] Dropped existing collection on target`);
      }

      const result = await targetColl.insertMany(docs, { ordered: false }).catch((err) => {
        // BulkWriteError: duplicate keys — some docs already exist, count inserted ones
        if (err.code === 11000 && err.result) {
          return err.result;
        }
        throw err;
      });

      const inserted = result.insertedCount ?? result.nInserted ?? "?";
      console.log(`  [${name}] Copied ${inserted}/${docs.length} documents`);
    }

    console.log("\nMigration complete!");
  } catch (err) {
    console.error("\nMigration failed:", err.message);
    process.exit(1);
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

migrate();
