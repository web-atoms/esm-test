import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

export default function forkTest(name, { args, env }) {

    return new Promise<{ log?, error? }>((resolve, reject) => {

        let log = [];

        const t1 = setTimeout(() => console.warn(`Test ${name} ran for more than 30 seconds`), 30000);

        env ??= {};
        env.NODE_OPTIONS ??= "--enable-source-maps";

        const test = fork( fileURLToPath(import.meta.resolve("./forkTestRunner.js")), {
            execArgv: args,
            env
        });

        test.on("message", (data: any) => {
            if (data.log) {
                log.push(data.log);
            }
            if(data.success) {
                clearTimeout(t1);
                resolve({ log: log.join("\n"), });
                return;
            }
            if (data.error) {
                clearTimeout(t1);
                resolve({ log: log.join("\n"), error: data.error});
            }
        });

        test.send({
            run: name
        });

        test.on("error", reject);
    });

}