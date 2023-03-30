const { readFileSync } = require("fs")


const i = `PUSH,
POP,
NEP,
READ,
TEST,
ADD,
SET,
CMP,
ICMP,
SKIP,
SIT,
SIF,
END,
SADD`.replace(/\n/g,"").split(",")


const j = readFileSync('./debug.as','utf-8')

console.log(i.map(a=>[a,[...j.matchAll(new RegExp(a,'g'))].length]).sort())