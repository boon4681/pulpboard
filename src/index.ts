import chalk from "chalk";
import { SyntaxError } from "./error";
import { Input } from "./input";
import { CMP, END, Instruction, InstructionType, SIF, SIT, POP, PUSH, READ, SADD } from "./instruction";
import { Address, Memory, Stack } from "./memo";
import { box } from "./test";
import { Group, IFWrapper, is_pack, Lexer, Pack, Reader, Token, Tokenizer, TokenizerType, Wrapper, WrapperSerial } from "./tokenizer";
import { appendFileSync, readFileSync, writeFileSync } from "fs";

function print(gg: Stack<Instruction>, out: boolean = false) {
    let k = 0;
    return [...gg.array].reverse().map((a, i) => {
        if (a.type == InstructionType.PUSH) k++
        if (a.type == InstructionType.POP) k--
        if (out) console.log(
            // i + 1, 
            new Array((k > -1 ? k : 0) + (a.type == InstructionType.PUSH ? -1 : 0)).fill('    ').join('') + a.constructor.name + ' ' + a.str()
        )
        return new Array((k > -1 ? k : 0) + (a.type == InstructionType.PUSH ? -1 : 0)).fill('    ').join('') + a.constructor.name + ' ' + a.str()
    })
}


export class LexerBase implements Lexer {
    stack: Tokenizer[] = [];
    scheme: Tokenizer[] = [];
    tokens: Token[] = [];
    index: number = 0;
    memo: Memory = new Memory()
    constructor(
        public source: Input
    ) {
        this.memo.scheme.push()
        this.memo.inst.add(new END())
        this.memo.inst.add_direct(box.compile([], [], new Map<number, Tokenizer>(), new Map<number, number>()))
        console.log(chalk.red("############\nINDEX.ts file\n############"))
        writeFileSync("debug3.txt", print(this.memo.inst).join("\n"))
        // return
        // console.log(this.tokens)
    }
    private merger(merge: number[], pack: Tokenizer) {
        if (pack.features.merge) {
            const removed = this.tokens.splice(merge.pop()!)
            if (removed.length) {
                const raw = removed.map(a => a.value).join('')
                this.tokens.push(
                    new Token(pack.name, raw, {
                        start: removed[0].span.start,
                        end: removed[removed.length - 1].span.end,
                        range: [
                            removed[0].span.range[0],
                            removed[removed.length - 1].span.range[1]
                        ],
                        size: removed[removed.length - 1].span.range[1] - removed[0].span.range[0]
                    })
                )
            }
        }
    }
    run() {
        const merge: number[] = []
        const inst_stack: (Stack<Instruction>)[] = [this.memo.inst]
        // writeFileSync("./test/debug.txt", "")
        let exec: Stack<Instruction> = inst_stack[inst_stack.length - 1]
        while (inst_stack.length > 0 && inst_stack[inst_stack.length - 1].size > 0) {
            exec = inst_stack[inst_stack.length - 1]
            const inst = exec.get() as any
            if(exec.get().type == InstructionType.END){
                break
            }
            // const log = chalk.yellow((exec.pointer + 1 + 10000).toString().slice(1)) + " " + new Array(this.memo.stack.size + (inst.type == InstructionType.POP ? -1 : 0)).fill('    ').join('') + chalk.red(inst.constructor.name + ' ' + inst.str())
            // appendFileSync("./test/debug.txt", log.replace(/\u001b[^m]*?m/g, "") + "\n")
            // console.log(log)
            // console.log([this.memo.stack.get()].map((a: any) => a ? [a.name, a.features, a.index, a.children.length] : a))
            // console.log(this.memo.global)
            // console.log(new Array(space + (inst.type == InstructionType.POP ? -1 : 0)).fill('    ').join('') + chalk.red(inst.constructor.name + ' ' + inst.str()))
            switch (inst.type) {
                case InstructionType.SADD:
                    (this.memo.stack.get() as Pack).index++
                    break
                case InstructionType.CMP:
                    {
                        const a = (typeof inst.address_a == "number") ? inst.address_a : this.memo.get_address(inst.address_a)
                        const b = (typeof inst.address_b == "number") ? inst.address_b : this.memo.get_address(inst.address_b)
                        this.memo.temp = a - b
                    }
                    break
                case InstructionType.SIF:
                    if (this.memo.temp != 0) {
                        exec.pointer += inst.mov
                    }
                    break
                case InstructionType.SIT:
                    if (this.memo.temp == 0) {
                        exec.pointer += inst.mov
                    }
                    break
                case InstructionType.READ:
                    {
                        let bool = 0
                        if (inst.reader.test(this)) {
                            const result = inst.reader.read(this)
                            if (!inst.reader.features.ignore) {
                                // console.log(result.value)
                                this.tokens.push(result)
                            }
                            bool = 1
                        }
                        if (inst.reader.features["nullable"]) {
                            bool = 1
                        }
                        // console.log("bool",bool)
                        this.memo.set_address(new Address(inst.variable, bool))
                    }
                    break
                case InstructionType.PUSH:
                    {
                        this.source.push()
                        const a = Object.assign({}, inst.tokenizer)
                        // const a = inst.tokenizer.New()
                        // a.id = inst.tokenizer.id + 0
                        this.memo.stack.add(a)
                        if (inst.tokenizer.features.merge) {
                            merge.push(this.tokens.length)
                        }
                        // console.log(this.memo.stack.pointer)
                        this.memo.Sid = this.memo.stack.get().id
                        // console.log(inst.tokenizer.id)
                        // console.log(this.memo.Sid)
                    }
                    break
                case InstructionType.POP:
                    {
                        // this.memo.temp = 0
                        const pack = this.memo.stack.get() as Pack
                        const have_parent = this.memo.stack.size > 1
                        // console.log(pack.index, this.memo.temp)
                        if (pack.children.length != pack.index) {
                            // console.log(pack)
                            const error = pack.children[pack.index]
                            if (this.memo.global.get("B") == 1 && pack.index == 0) {
                                // pass
                                this.memo.temp = 1
                            } else if (pack.index == 0 && pack.features.nullable) {
                                // pass
                                this.memo.temp = 1
                            } else if (pack.index == 0 && this.memo.stack.get(-1)) {
                                // pass
                                this.memo.temp = 1
                            } else if (pack.type == TokenizerType.Group || pack.type == TokenizerType.GroupSerial || pack.type == TokenizerType.WrapperSerial) {
                                if (this.memo.global.get("B") == 1) this.memo.temp = 0
                            } else if (have_parent && !(this.memo.stack.get(-1).type == TokenizerType.WrapperSerial || this.memo.stack.get(-1).type == TokenizerType.GroupSerial)) {
                                // this.memo.temp = 0
                            } else {
                                console.log(this.tokens.map(a => a.value))
                                console.log(this.memo.stack.array.map((a: any) => [a.name, a.features, a.index, a.children.length]))
                                throw new SyntaxError('1', this.source, error)
                            }
                        }
                        // console.log(pack.index, this.memo.temp)
                        // console.log(pack.index,this.memo.temp)
                        this.merger(merge, pack)
                        const pop = this.source.pop()
                        this.source.set(pop)
                        this.memo.stack.pop()
                        if (this.memo.stack.size > 0) {
                            this.memo.Sid = this.memo.stack.get().id
                        }
                    }
                    break
                case InstructionType.SKIP:
                    {
                        exec.pointer += inst.mov
                    }
                    break
                case InstructionType.STACK:
                    {
                        inst_stack.push(new Stack<Instruction>().add_direct(inst.inst))
                        continue
                    }
                    break
                case InstructionType.TEST:
                    if (inst.tester.test(this)) {
                        this.memo.set_address(new Address(inst.variable, 1))
                    } else {
                        this.memo.set_address(new Address(inst.variable, 0))
                    }
                    break
                case InstructionType.SET:
                    {
                        this.memo.set_address(inst.address)
                    }
                    break
                case InstructionType.NEP:
                    {
                        const pop = this.source.pop()
                        this.source.set(pop)

                        const pack = this.memo.stack.get()
                        this.merger(merge, pack)

                        this.memo.stack.pop()
                        exec.pointer += inst.mov
                        this.memo.temp = 0
                    }
                    break
                case InstructionType.ADD:
                    {
                        if (!this.memo.get_address(inst.address)) {
                            this.memo.set_address(new Address(inst.address.location, 0))
                        }
                        const v = this.memo.get_address(inst.address)! + inst.address.assigned
                        this.memo.set_address(new Address(inst.address.location, v))
                    }
                    break
                default:
                    // console.log(inst)
                    throw new Error("Unknown")
            }
            exec.next()
            if (exec.size == exec.pointer) {
                inst_stack.pop()
                if (inst_stack.length > 0) {
                    inst_stack[inst_stack.length - 1].next()
                }
            }
        }
    }
}
// const input = new Input("", new Array(2000).fill("").map((a, i) => i < 1000 ? '(' : ')').join(""))
const input = new Input("", readFileSync("./test/test.box", "utf8"))
const lexer = new LexerBase(input)
function main() {
    const t0 = performance.now();
    lexer.run()
    const t1 = performance.now();
    console.log(lexer.tokens)
    console.log(`${t1 - t0} milliseconds.`);
}
main()