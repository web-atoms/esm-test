import { fork } from "node:child_process";

export default async function forkTest(name) {

    const test = fork("./forkTest.js");

    test.on("message", (data) => {
        
    });

}