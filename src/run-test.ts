import { pathToFileURL } from "node:url";

async function run(name) {
    const url = pathToFileURL(name);
    // name = `file://${name.replaceAll("\\", "/")}`;
    // console.log(`Executing ${name}`)
    const r = await import(url.toString());
    if (!r.default) {
        return;
    }
    await r.default();
}
run(process.argv[2]).then(() => {
    process.exitCode = 0;
    process.exit(0);
}, (error) => {
    console.error(error);
    process.exitCode = 1;
    process.exit(1);
});