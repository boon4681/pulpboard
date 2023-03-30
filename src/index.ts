import chalk from "chalk";
import { SyntaxError } from "./error";
import { Input } from "./input";
import { CMP, END, Instruction, InstructionType, SIF, SIT, POP, PUSH, READ, SADD } from "./instruction";
import { Address, Memory, Stack } from "./memo";
import { box } from "./test";
import { Group, IFWrapper, is_pack, Lexer, Pack, Reader, Token, Tokenizer, TokenizerType, Wrapper, WrapperSerial } from "./tokenizer";



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
        this.memo.inst.add_direct(box.compile().array)
        let k = 0;
        [...this.memo.inst.array].reverse().map((a, i) => {
            if (a.type == InstructionType.PUSH) k++
            if (a.type == InstructionType.POP) k--
            console.log(
                // i + 1, 
                new Array((k > -1 ? k : 0) + (a.type == InstructionType.PUSH ? -1 : 0)).fill('    ').join('') + a.constructor.name + ' ' + a.str()
            )
        })
        // return
        // console.log(this.tokens)
    }
    run() {
        let merge: number[] = []
        while (this.memo.inst.size > 0 && this.memo.inst.get().type != InstructionType.END) {
            const inst = this.memo.inst.get() as any
            console.log(this.memo.inst.pointer + 1, new Array(this.memo.stack.size + (inst.type == InstructionType.POP ? -1 : 0)).fill('    ').join('') + chalk.red(inst.constructor.name + ' ' + inst.str()))
            // console.log(this.memo)
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
                case InstructionType.ADD:
                    {
                        if (!this.memo.get_address(inst.address)) {
                            this.memo.set_address(new Address(inst.address.location, 0))
                        }
                        const v = this.memo.get_address(inst.address)! + inst.address.assigned
                        this.memo.set_address(new Address(inst.address.location, v))
                    }
                    break
                case InstructionType.SKIP:
                    this.memo.inst.pointer += inst.mov
                    break
                case InstructionType.READ:
                    {
                        let bool = 0
                        if (inst.reader.test(this)) {
                            const result = inst.reader.read(this)
                            if (!inst.reader.features.ignore) {
                                this.tokens.push(result)
                            }
                            bool = 1
                        }
                        // console.log("bool",bool)
                        this.memo.set_address(new Address(inst.variable, bool))
                    }
                    break
                case InstructionType.SIT:
                    if (this.memo.temp == 0) {
                        this.memo.inst.pointer += inst.mov
                    }
                    break
                case InstructionType.SIF:
                    if (this.memo.temp != 0) {
                        this.memo.inst.pointer += inst.mov
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
                        this.memo.temp = 0
                        const pack = this.memo.stack.get() as Pack
                        if (pack.children.length != pack.index) {
                            // console.log(pack)
                            let error = pack.children[pack.index]
                            if (this.memo.global.get("B") == 1 && pack.index == 0) {
                                // pass
                                this.memo.temp = 0
                            } else if (pack.index == 0 && pack.features.nullable) {
                                // pass
                                this.memo.temp = 1
                            } else if (pack.index == 0 && this.memo.stack.get(-1)) {
                                // pass
                                this.memo.temp = 1
                            } else {
                                console.log(this.memo.stack.array.map((a: any) => [a.name, a.features, a.index, a.children.length]))
                                throw new SyntaxError('1', this.source, error)
                            }
                        }
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
                        const pop = this.source.pop()
                        this.source.set(pop)
                        this.memo.stack.pop()
                        if (this.memo.stack.get()) {
                            this.memo.Sid = this.memo.stack.get().id
                        }
                    }
                    break
                case InstructionType.ICMP:
                    {
                        this.memo.temp = this.memo.Sid - inst.id
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
                    this.memo.set_address(inst.address)
                    break
                case InstructionType.NEP:
                    const pop = this.source.pop()
                    this.source.set(pop)
                    this.memo.stack.pop()
                    this.memo.temp = 1
                    this.memo.inst.pointer += inst.mov
                    break
                default:
                    console.log(inst)
                    throw new Error("Unknown")
            }
            this.memo.inst.next()
        }
    }
}
// const input = new Input("", new Array(2000).fill("").map((a, i) => i < 1000 ? '(' : ')').join(""))
const input = new Input("", "((()))(hello")
const lexer = new LexerBase(input)
function main() {
    const t0 = performance.now();
    lexer.run()
    const t1 = performance.now();
    console.log(lexer.tokens)
    console.log(`${t1 - t0} milliseconds.`);
}
main()