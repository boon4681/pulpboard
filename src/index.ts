import chalk from "chalk";
import { SyntaxError, UnknownSyntax } from "./error";
import { Input } from "./input";
import { CMP, END, Instruction, InstructionType, SIF, SIT, POP, PUSH, READ, SADD, STACK, TEST } from "./instruction";
import { Memory, Stack } from "./memo";
import { box } from "./test";
import { createToken, Group, IFWrapper, is_pack, Lexer, Pack, Reader, Token, Tokenizer, TokenizerType, Wrapper, WrapperSerial } from "./tokenizer";
import { appendFileSync, read, readFileSync, writeFileSync } from "fs";

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
    scheme: Tokenizer[] = [];
    tokens: Token[] = [];
    index: number = 0;
    memo: Memory = new Memory()
    constructor(
        scheme: Pack,
        public source: Input,
    ) {
        // this.memo.scheme.push()
        this.memo.inst.push(new END())
        this.memo.inst.push(...scheme.convert([], [], new Map<number, Tokenizer>(), new Map<number, number>()))
        // console.log(chalk.red("############\nINDEX.ts file\n############"))
        // writeFileSync("debug3.txt", print(this.memo.inst).join("\n"))
        // return
        // console.log(this.tokens)
    }
    private merger(merge: number[], pack: Tokenizer) {
        const removed = this.tokens.splice(merge.pop()!)
        if (removed.length) {
            const raw = removed.map(a => a.value).join('')
            this.tokens.push(
                createToken(pack.name, raw, {
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
    private nullable_rev(): boolean {
        let i = 1
        let p: Pack = this.memo.stack.get(-i) as Pack
        while (i < this.memo.stack.size) {
            p = this.memo.stack.get(-i) as Pack
            if (p.index == 0) return false
            if (p.features.nullable) {
                return true
            }
            i++
        }
        return false
    }
    public run() {
        const merge: number[] = []
        const INST = this.memo.inst
        const inst_stack: ({ start: number, size: number, pointer: number })[] = [
            {
                start: INST.length,
                size: INST.length,
                pointer: 0
            }
        ]
        // writeFileSync("./test/debug.txt", "")
        let exec: { start: number, size: number, pointer: number } = inst_stack[0]
        let inst = INST[exec.start - exec.pointer - 1] as any
        let bool = 0
        // const hack:any = {
        //     11: () => {
        //         (this.memo.stack.get() as Pack).index++
        //     },
        //     9: () => {
        //         if (this.memo.temp != 0) {
        //             exec.pointer += inst.mov
        //         }
        //     },
        //     6: () => {
        //         const a = this.memo.get_address(inst.address_a)
        //         const b = (typeof inst.address_b == "number") ? inst.address_b : this.memo.get_address(inst.address_b)
        //         this.memo.temp = a - b
        //     },
        //     3: () => {
        //         let bool = 0
        //         if (inst.reader.test(this)) {
        //             const result = inst.reader.read(this)
        //             if (!inst.reader.features.ignore) {
        //                 // console.log(result.value)
        //                 this.tokens.push(result)
        //             }
        //             bool = 1
        //         }
        //         if (inst.reader.features["nullable"]) {
        //             bool = 1
        //         }
        //         // console.log("bool",bool)
        //         this.memo.set_address(inst.variable, bool)
        //     },
        //     0: () => {
        //         this.source.push()
        //         const a = Object.assign({}, inst.tokenizer)
        //         this.memo.stack.add(a)
        //         if (inst.tokenizer.features.merge) {
        //             merge.push(this.tokens.length)
        //         }
        //     },
        //     1: () => {
        //         const pack = this.memo.stack.get() as Pack
        //         // console.log(pack.index, this.memo.temp)
        //         if (pack.children.length != pack.index) {
        //             const have_parent = this.memo.stack.size
        //             const parent = this.memo.stack.get(-1)
        //             // console.log(pack)
        //             // appendFileSync("./test/debug.txt", 'VERY DEBUG' + this.memo.temp + JSON.stringify([...this.memo.global.entries()]) + '\n')
        //             const error = pack.children[pack.index]
        //             if (this.memo.B == 1 && pack.index == 0) {
        //                 this.memo.temp = 1
        //             } else if (pack.index == 0 && pack.features.nullable) {
        //                 this.memo.temp = 1
        //             } else if (pack.index == 0 && have_parent) {
        //                 this.memo.temp = 1
        //             } else if (pack.type == TokenizerType.Group || pack.type == TokenizerType.GroupSerial || pack.type == TokenizerType.WrapperSerial) {
        //                 if (this.memo.B == 1) this.memo.temp = 0
        //             } else if (have_parent && !(parent.type == TokenizerType.WrapperSerial || parent.type == TokenizerType.GroupSerial)) {
        //                 const nullable = this.nullable_rev()
        //                 if (!nullable) {
        //                     throw new SyntaxError('2', this.source, error)
        //                 }
        //                 if (pack.index > 0 && parent.type != TokenizerType.Group && (pack.type == TokenizerType.Wrapper || pack.type == TokenizerType.IFWrapper)) {
        //                     throw new SyntaxError('2', this.source, error)
        //                 }
        //             } else {
        //                 // console.log(this.tokens.map(a => a.value))
        //                 throw new SyntaxError('1', this.source, error)
        //             }
        //         }
        //         if (pack.features.merge) {
        //             this.merger(merge, pack)
        //         }
        //         this.source.set(this.source.pop())
        //         this.memo.stack.pop()
        //     },
        //     8: () => {
        //         if (this.memo.temp == 0) {
        //             exec.pointer += inst.mov
        //         }
        //     },
        //     7: () => {
        //         exec.pointer += inst.mov
        //     },
        //     12: () => {
        //         inst_stack.push({
        //             start: inst.start + inst.size,
        //             size: inst.size,
        //             pointer: 0
        //         })
        //     },
        //     4:() => {
        //         if (inst.tester.test(this)) {
        //             this.memo.set_address(inst.variable, 1)
        //         } else {
        //             this.memo.set_address(inst.variable, 0)
        //         }
        //     },
        //     5:()=>{
        //         this.memo.set_address(inst.address, inst.data)
        //     },
        //     2:()=>{
        //         this.source.set(this.source.pop())

        //         const pack = this.memo.stack.get()
        //         if (pack.features.merge) {
        //             this.merger(merge, pack)
        //         }
    
        //         this.memo.stack.pop()
        //         exec.pointer += inst.mov
        //         this.memo.temp = 0
        //     }
        // }

        while (inst_stack.length) {
            exec = inst_stack[inst_stack.length - 1]
            inst = INST[exec.start - exec.pointer - 1] as any
            // console.log((INST.size - exec.start) - exec.size + exec.pointer)
            // throw new Error
            if (inst.type == InstructionType.END) break
            // const log = chalk.yellow((exec.pointer + 1 + 10000).toString().slice(1)) + " " + new Array(this.memo.stack.size + (inst.type == InstructionType.POP ? -1 : 0)).fill('    ').join('') + chalk.red(inst.constructor.name + ' ' + inst.str())
            // appendFileSync("./test/debug.txt", log.replace(/\u001b[^m]*?m/g, "") + "\n")
            // console.log(log)
            // console.log([this.memo.stack.get()].map((a: any) => a ? [a.name, a.features, a.index, a.children.length] : a))
            // console.log(this.memo.global)
            // console.log(new Array(space + (inst.type == InstructionType.POP ? -1 : 0)).fill('    ').join('') + chalk.red(inst.constructor.name + ' ' + inst.str()))
            // if (inst.type == InstructionType.STACK) {
            //     hack[inst.type]()
            //     continue
            // }
            // hack[inst.type]()
            switch (inst.type) {
                case InstructionType.SADD:
                    {
                        (this.memo.stack.get() as Pack).index++
                    }
                    break
                case InstructionType.SIF:
                    {
                        if (this.memo.temp != 0) {
                            exec.pointer += inst.mov
                        }
                    }
                    break
                case InstructionType.CMP:
                    {
                        const a = this.memo.get_address(inst.address_a)
                        const b = (typeof inst.address_b == "number") ? inst.address_b : this.memo.get_address(inst.address_b)
                        this.memo.temp = a - b
                    }
                    break
                case InstructionType.READ:
                    {
                        bool = 0
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
                        this.memo.set_address(inst.variable, bool)
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
                        // this.memo.Sid = this.memo.stack.get().id
                        // console.log(inst.tokenizer.id)
                        // console.log(this.memo.Sid)
                    }
                    break
                case InstructionType.POP:
                    {
                        // this.memo.temp = 0
                        const pack = this.memo.stack.get() as Pack
                        // console.log(pack.index, this.memo.temp)
                        if (pack.children.length != pack.index) {
                            // console.log(pack)
                            // appendFileSync("./test/debug.txt", 'VERY DEBUG' + this.memo.temp + JSON.stringify([...this.memo.global.entries()]) + '\n')
                            const have_parent = this.memo.stack.size
                            const parent = this.memo.stack.get(-1)
                            const error = pack.children[pack.index]
                            if (this.memo.B == 1 && pack.index == 0) {
                                this.memo.temp = 1
                            } else if (pack.index == 0 && pack.features.nullable) {
                                this.memo.temp = 1
                            } else if (pack.index == 0 && have_parent) {
                                this.memo.temp = 1
                            } else if (pack.type == TokenizerType.Group || pack.type == TokenizerType.GroupSerial || pack.type == TokenizerType.WrapperSerial) {
                                if (this.memo.B == 1) this.memo.temp = 0
                            } else if (have_parent && !(parent.type == TokenizerType.WrapperSerial || parent.type == TokenizerType.GroupSerial)) {
                                const nullable = this.nullable_rev()
                                // appendFileSync("./test/debug.txt", "FUCKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK\n")
                                // appendFileSync("./test/debug.txt", nullable + ' ' + p.name + "\n")
                                // appendFileSync("./test/debug.txt", this.memo.temp + JSON.stringify([...this.memo.global.entries()]) + '\n')
                                if (!nullable) {
                                    throw new SyntaxError('2', this.source, error)
                                }
                                if (pack.index > 0 && parent.type != TokenizerType.Group && (pack.type == TokenizerType.Wrapper || pack.type == TokenizerType.IFWrapper)) {
                                    throw new SyntaxError('2', this.source, error)
                                }
                            } else {
                                console.log(this.tokens.map(a => a.value))
                                throw new SyntaxError('1', this.source, error)
                            }
                        }
                        // console.log(pack.index, this.memo.temp)
                        // console.log(pack.index,this.memo.temp)
                        if (pack.features.merge) {
                            this.merger(merge, pack)
                        }
                        this.source.set(this.source.pop())
                        this.memo.stack.pop()
                    }
                    break
                case InstructionType.SIT:
                    {
                        if (this.memo.temp == 0) {
                            exec.pointer += inst.mov
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
                        // console.log("STACTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT")
                        inst_stack.push({
                            start: inst.start + inst.size,
                            size: inst.size,
                            pointer: 0
                        })
                        continue
                    }
                    break
                case InstructionType.TEST:
                    if (inst.tester.test(this)) {
                        this.memo.set_address(inst.variable, 1)
                    } else {
                        this.memo.set_address(inst.variable, 0)
                    }
                    break
                case InstructionType.SET:
                    {
                        this.memo.set_address(inst.address, inst.data)
                    }
                    break
                case InstructionType.NEP:
                    {

                        this.source.set(this.source.pop())

                        const pack = this.memo.stack.get()
                        if (pack.features.merge) {
                            this.merger(merge, pack)
                        }

                        this.memo.stack.pop()
                        exec.pointer += inst.mov
                        this.memo.temp = 0
                    }
                    break
                default:
                    // console.log(inst)
                    throw new Error("Unknown")
            }
            exec.pointer++
            if (exec.size == exec.pointer) {
                inst_stack.length--
                if (inst_stack.length) {
                    inst_stack[inst_stack.length - 1].pointer++
                }
            }
        }
        if (!this.source.eof()) {
            throw new UnknownSyntax("3", this.source)
        }
    }
}
// const input = new Input("", new Array(2000).fill("").map((a, i) => i < 1000 ? '(' : ')').join(""))
const input = new Input("./test/test.box", readFileSync("./test/test.box", {
    encoding: "utf8"
}))
const lexer = new LexerBase(box, input)
function main() {
    const t0 = performance.now();
    lexer.run()
    const t1 = performance.now();
    console.log(lexer.tokens)
    console.log(`${t1 - t0} milliseconds.`);
}
main()