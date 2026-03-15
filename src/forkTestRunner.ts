async function runTest(name) {
    console.log = (... a) => process.send({ log: a.join() });
    console.error = console.log;
    console.warn = console.log;
    console.info = console.info;
    console.debug = console.debug;
    const r = await import(name);
    const def = r?.default;
    if(!def) {
        return;
    }
    const p = def();
    if (p?.then) {
        await p;
    }
}

global.document = null;

process.on("message", (msg: { run }) => {
    const { run } = msg;
    if(!run) {
        return;
    }

    runTest(run).then(() => {
        process.send({ success: true});
        process.exit(0);
    }, (error) => {
        process.send({
            error: error.cause
                ? (error.cause.stack || error.cause) + "\n" + (error.stack || error)
                : error.stack || error
        });
        process.exit(1);
    });
});