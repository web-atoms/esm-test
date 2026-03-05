/* eslint-disable no-console */
import { readdir } from "node:fs/promises";
import path, { join } from "node:path";
import { pathToFileURL } from "url";
import forkTest from "./forkTest.js";


/**
 * @type Array<{ name: string, error: string }>
 */
let results = [];

let start: number;

export default class TestRunner {


    public static async run(folder: string, factory?: ({ id, args, env }) => { id, args, env}) {

        start = Date.now();
        results = [];

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

        TestRunner.testFile = testFile;

        await TestRunner.runAll(folder, factory);

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
                console.error(error);
                // console.error(error?.stack ?? error);
                continue;
            }
            console.log(`${name} executed.`);
        }

        if (exitCode === 0) {
            console.log(`${results.length} tests ran successfully.`);
        } else {
            console.log(`${failed} Tests out of ${results.length} failed.`);
            process.exitCode = exitCode;
        }

        // process.exit(exitCode);
    }

    private static testFile: any;

    /**
     *
     * @param {string} name
     */
    private static async runTest(name, factory: ({ id, args, env }) => { id, args, env}) {

        const { testFile } = TestRunner;
        if (!testFile) {
            const id = start++;

            try {
                let args = [];
                let env = {};
                const f = factory?.({ id, args, env: {}});
                args = f?.args ?? args;
                env = f?.env ?? env;
                const result = await forkTest(pathToFileURL(name),{
                    args,
                    env
                });
                if (result.error) {
                    results.unshift({ name, error: result.error + "\n" + result.log });
                } else {
                    // console.log(`Test Success: ${name}`);
                    results.push({ name, log: result.log });
                }
            } catch (e) {
                console.error(e);
                results.unshift({ name, error: e });
            }
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

    private static async runAll(dir, factory) {
        const { testFile } = TestRunner;
        const items = await readdir(dir, { withFileTypes: true, recursive: true });
        for (const iterator of items) {
            const next = join(iterator.parentPath, iterator.name);
            if (iterator.isDirectory()) {
                // await this.runAll(next, factory);
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

                await this.runTest(next, factory);
            }
        }
    }

}

