/* eslint-disable no-console */
import { readdir } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { existsSync, mkdirSync } from "fs";
import { spawnPromise } from "../common/spawnPromise.js";
import { fileURLToPath, pathToFileURL } from "url";

const ensureDir = (d) => {
    if(!existsSync(d)) {
        mkdirSync(d, { recursive: true });
    }
    return d;
};

let testFile;
const testFileIndex = process.argv.indexOf("--test-file");
if (testFileIndex !== -1) {
    testFile = process.argv[testFileIndex+1];
}
testFile = testFile ? testFile.replace("/src/", "/dist/").replace("\\src\\","\\dist\\").replace(".ts", ".js") : void 0;
if (testFile) {
    if (testFile.startsWith(".")) {
        testFile = path.resolve(testFile);
    }
    console.log(`Executing test - ${testFile}`);
}

/**
 * @type Array<{ name: string, error: string }>
 */
const results = [];

let start = Date.now();

export default class TestRunner {


    /**
     *
     * @param {string} name
     */
    static async runTest(name) {

        if (!testFile) {
            const dbID = start++;
            const db = `casting_${dbID}`;
            const tPath = ensureDir(`${tmpdir()}/t-${dbID}/t`);
            const tcPath = ensureDir(`${tmpdir()}/t-${dbID}/tc`);

            const runTestPath = import.meta.resolve("./run-test.js");


            const t1 = setTimeout(() => console.warn(`Test ${name} ran for more than 30 seconds`), 30000);
            try {
                const result = await spawnPromise("node", ["--enable-source-maps", fileURLToPath(runTestPath), name], {
                    logData: false,
                    logCommand: false,
                    throwOnFail: true,
                    logError: false,
                    env: {
                        ... process.env,
                        CASTING_SERVER_DB_TEST_MODE: void 0,
                        CASTING_SERVER_TEST_MODE: "true",
                        CASTING_SERVER_SERVER_ID: `${dbID}`,
                        CASTING_SERVER_TMP_PATH: tPath,
                        CASTING_SERVER_CACHE_PATH: tcPath,
                        CASTING_SERVER_DB_DATABASE: db
                    }
                });
                if (result.status > 0) {
                    results.unshift({ name, error: result.all });
                } else {
                    // console.log(`Test Success: ${name}`);
                    results.push({ name, log: result.all });
                }
            } catch (e) {
                results.unshift({ name, error: e });
            }
            clearTimeout(t1);
            return;
        }

        const moduleExports = await import(pathToFileURL(name).toString());
        const { default: d } = moduleExports;
        if (!d) {
            return;
        }
        const timeout = setTimeout(() => console.warn(`Test ${name} ran for more than 30 seconds`), 30000);
        try {

            const r = d.call();
            if (r?.then) {
                await r;
            }
            results.push({ name });
        } catch (error) {
            results.unshift({ name, error });
        }
        clearTimeout(timeout);
    }

    static async runAll(dir) {
        const items = await readdir(dir, { withFileTypes: true });
        for (const iterator of items) {
            const next = dir + "/" +  iterator.name;
            if (iterator.isDirectory()) {
                await this.runAll(next);
                continue;
            }
            if (iterator.name.endsWith(".test.js")) {

                if (testFile) {
                    if (next !== testFile) {
                        if(testFile !== path.resolve(next)) {
                            continue;
                        }
                    }
                }

                await this.runTest(next);
            }
        }
    }

}

await TestRunner.runAll(import.meta.dirname);

let exitCode = 0;
let failed = 0;

for (const { error, name } of results) {
    if (error) {
        exitCode = 1;
        failed++;
        console.error(`${name} failed`);
        if (testFile) {
            console.error(error?.stack ?? error);
        }
        // console.error(error?.stack ?? error);
        continue;
    }
    console.log(`${name} executed.`);
}

if (exitCode === 0) {
    console.log(`${results.length} tests ran successfully.`);
} else {
    console.log(`${failed} Tests out of ${results.length} failed.`);
}

process.exit(exitCode);