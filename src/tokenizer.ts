import chalk from "chalk"
import { Input } from "./input"
import { CMP, Instruction, InstructionType, SIF, SIT, POP, PUSH, READ, SADD, SET, TEST, NEP, SKIP, STACK } from "./instruction"
import { Stack } from "./memo"

let id = 1

export type Range = [number, number]

export type Location = {
    line: number
    column: number
}

export type Span = {
    start: Location
    end: Location
    range: Range
    size: number
}

export class Token {
    name: string
    value: string
    span: Span

    constructor(name: string, raw: string, span: Span) {
        this.name = name
        this.value = raw
        this.span = span
    }
}

export function createToken(name: string, raw: string, span: Span): Token {
    let t:any = {}
    t.name = name
    t.value = raw
    t.span = span
    return t
}

export interface Lexer {
    scheme: Tokenizer[]
    tokens: Token[]
    source: Input
    index: number
}

export enum TokenizerType {
    Reader,
    Wrapper,
    WrapperSerial,
    IFWrapper,
    Group,
    GroupSerial
}

export const is_pack = (type: TokenizerType) => {
    return [
        TokenizerType.Wrapper,
        TokenizerType.WrapperSerial,
        TokenizerType.IFWrapper,
        TokenizerType.Group,
        TokenizerType.GroupSerial,
    ].includes(type)
}

export interface Tokenizer {
    id: number
    type: TokenizerType | null
    name: string
    features: Record<string, any>
    test(lexer: Lexer): boolean
    read(lexer: Lexer): Token
    New(): Tokenizer
    set(name: string, value: any): Tokenizer
}

export class Reader implements Tokenizer {
    id = id++
    type = TokenizerType.Reader
    features: Record<string, any> = {}
    constructor(
        public name: string,
        public regex: RegExp
    ) {

    }
    test(lexer: Lexer): boolean {
        return lexer.source.to_end().search(this.regex) == 0
    }

    read(lexer: Lexer): Token {
        const match = this.regex.exec(lexer.source.to_end())
        const source = lexer.source
        const start_line = source.line + 0
        const start_col = source.column + 0
        if (match) {
            const start = source.index
            const end = start + match[0].length + 0
            const value = source.seek(match[0].length)
            return createToken(this.name, value, {
                start: {
                    line: start_line,
                    column: start_col
                },
                end: {
                    line: source.line,
                    column: source.column
                },
                range: [start, end],
                size: value.length
            })
        }
        throw new Error(`${source.name}:${start_line}:${start_col}\n${source.pan([-100, 0], true)} <- missing ${this.regex}`)
    }

    New(name?: string): Reader {
        const C = new Reader(name ? name : this.name, this.regex)
        C.features = this.features
        return C
    }

    set(name: string, value: any) {
        this.features[name] = value
        return this
    }
}

export abstract class Pack implements Tokenizer {
    id = id++
    type: TokenizerType | null = null
    index: number = 0
    features: Record<string, any> = {}
    children: Tokenizer[] = []
    constructor(
        public name: string
    ) {
        // console.log(this.name)
    }
    test(lexer: Lexer): boolean {
        throw new Error("Method not implemented.")
    }
    read(lexer: Lexer): Token {
        throw new Error("Method not implemented.")
    }
    convert(stack: Tokenizer[], inst: Instruction[], call: Map<number, Tokenizer>, nep: Map<number, number>): Instruction[] {
        throw new Error("Method not implemented.")
    }
    New(): Pack {
        throw new Error("Method not implemented.")
    }
    set(name: string, value: any) {
        this.features[name] = value
        return this
    }
    add(items: Tokenizer[] | Tokenizer) {
        const items_ = [items].flat(1) as Tokenizer[]
        for (let i = 0; i < items_.length; i++) {
            this.children.push(items_[i])
        }
        return this
    }
    ignore(list: string[]) {
        this.children = this.children.filter(a => !list.includes(a.name))
        return this
    }
    c_name() {
        return this.name.replace(/[^\w]/, ".").split(".").map(a => a[0].toUpperCase() + a.slice(1)).join("")
    }
}

export class Wrapper extends Pack {
    type = TokenizerType.Wrapper
    index: number = 0
    features: Record<string, any> = {}
    constructor(
        name: string,
        public children: Tokenizer[] = []
    ) {
        super(name)
    }
    convert(stack: Tokenizer[], inst: Instruction[], call: Map<number, Tokenizer>, nep: Map<number, number>): Instruction[] {
        stack.push(this)
        const backward: number[] = []
        const w = inst.push(new POP())

        for (let i = this.children.length - 1; i >= 0; i--) {
            const tnz = this.children[i]
            inst.push(new SADD())
            if (tnz.features["nullable"] != true) {
                inst.push(new SIF(inst.length - w))
            }
            if (tnz.type == TokenizerType.Reader) {
                inst.push(new CMP("A", 1))
                inst.push(new READ(tnz, "A"))
            } else {
                const calling = stack.find((a, i) => a === tnz && i != stack.length - 1) ? true : tnz === this ? true : false
                if (calling) {
                    call.set(inst.push(new STACK(tnz.name, 0, 0, 0)), tnz)
                } else {
                    (tnz as Pack).convert(stack, inst, call, nep)
                }
            }
        }
        inst.push(new PUSH(this))
        for (const i of backward) {
            (inst[i] as SKIP).mov = i - inst.length - 2
        }
        for (const i of call) {
            if (i[1].id == this.id) {
                const stack = inst[i[0] - 1] as STACK
                stack.start = w
                stack.size = inst.length - w + 1
                call.delete(i[0])
            }
        }
        for (const i of nep) {
            if (i[1] == this.id) {
                (inst[i[0] - 1] as NEP).mov = i[0] - w + 1
                nep.delete(i[0])
            }
        }
        stack.pop()
        return inst
    }
    New(): Wrapper {
        const C = new Wrapper(this.name, this.children)
        C.features = Object.assign({}, this.features)
        return C
    }
}

export class IFWrapper extends Pack {
    type = TokenizerType.IFWrapper
    index: number = 0
    features: Record<string, any> = {}
    constructor(
        name: string,
        public condition: Reader,
        public children: Tokenizer[] = [],
    ) {
        super(name)
    }
    convert(stack: Tokenizer[], inst: Instruction[], call: Map<number, Tokenizer>, nep: Map<number, number>): Instruction[] {
        stack.push(this)
        const nep_enable = this.features["stop"] == true
        if (nep_enable) {
            nep.set(inst.push(new NEP(0)), stack[stack.length - 2].id)
            inst.push(new SIF(1))
        }
        const w = inst.push(new POP())
        for (let i = this.children.length - 1; i >= 0; i--) {
            const tnz = this.children[i]
            inst.push(new SADD())
            if (tnz.features["nullable"] != true) {
                inst.push(new SIF(inst.length - w))
            }
            if (tnz.type == TokenizerType.Reader) {
                inst.push(new CMP("A", 1))
                inst.push(new READ(tnz, "A"))
            } else {
                const calling = stack.find((a, i) => a === tnz && i != stack.length - 1) ? true : tnz === this ? true : false
                if (calling) {
                    call.set(inst.push(new STACK(tnz.name, 0, 0, 0)), tnz)
                } else {
                    (tnz as Pack).convert(stack, inst, call, nep)
                }
            }
        }
        inst.push(new PUSH(this))
        inst.push(new SIT(inst.length - w + 2 + (nep_enable ? 1 : 0)))
        inst.push(new CMP("T", 0))
        inst.push(new TEST(this.condition, "T"))
        for (const i of call) {
            if (i[1].id == this.id) {
                const stack = inst[i[0] - 1] as STACK
                stack.start = w
                stack.size = inst.length - w + 1
                call.delete(i[0])
            }
        }
        for (const i of nep) {
            if (i[1] == this.id) {
                (inst[i[0] - 1] as NEP).mov = i[0] - w + 1
                nep.delete(i[0])
            }
        }
        stack.pop()
        return inst
    }
    New(): IFWrapper {
        const C = new IFWrapper(this.name, this.condition, this.children)
        C.features = Object.assign({}, this.features)
        return C
    }
}

export class WrapperSerial extends Pack {
    type = TokenizerType.WrapperSerial
    index: number = 0
    features = {}
    constructor(
        name: string,
        public children: Tokenizer[] = []
    ) {
        super(name)
    }
    convert(stack: Tokenizer[], inst: Instruction[], call: Map<number, Tokenizer>, nep: Map<number, number>): Instruction[] {
        stack.push(this)
        inst.push(new SET("B", 0))
        inst.push(new SIT(0))
        inst.push(new SET("B", 1))
        const w = inst.push(new POP())
        for (let i = this.children.length - 1; i >= 0; i--) {
            const tnz = this.children[i]
            inst.push(new SADD())
            if (tnz.features["nullable"] != true) {
                inst.push(new SIF(inst.length - w))
            }
            if (tnz.type == TokenizerType.Reader) {
                inst.push(new CMP("A", 1))
                inst.push(new READ(tnz, "A"))
            } else {
                const calling = stack.find((a, i) => a === tnz && i != stack.length - 1) ? true : tnz === this ? true : false
                if (calling) {
                    call.set(inst.push(new STACK(tnz.name, 0, 0, 0)), tnz)
                } else {
                    (tnz as Pack).convert(stack, inst, call, nep)
                }
            }
        }
        inst.push(new PUSH(this));
        (inst[w - 3] as SIT).mov = w - inst.length - 3
        for (const i of call) {
            if (i[1].id == this.id) {
                const stack = inst[i[0] - 1] as STACK
                stack.start = w
                stack.size = inst.length - w + 1
                call.delete(i[0])
            }
        }
        for (const i of nep) {
            if (i[1] == this.id) {
                (inst[i[0] - 1] as NEP).mov = i[0] - w + 1
                nep.delete(i[0])
            }
        }
        stack.pop()
        return inst
    }
    New(): WrapperSerial {
        const C = new WrapperSerial(this.name, this.children)
        C.features = Object.assign({}, this.features)
        return C
    }
}

export class Group extends Pack {
    type = TokenizerType.Group
    index: number = 0
    features = {}
    constructor(
        name: string,
        public children: Tokenizer[] = []
    ) {
        super(name)
    }
    convert(stack: Tokenizer[], inst: Instruction[], call: Map<number, Tokenizer>, nep: Map<number, number>): Instruction[] {
        stack.push(this)
        const w = inst.push(new POP())
        for (let i = this.children.length - 1; i >= 0; i--) {
            const tnz = this.children[i]
            inst.push(new SIT(inst.length - w))
            inst.push(new SADD())
            if (tnz.type == TokenizerType.Reader) {
                inst.push(new CMP("A", 1))
                inst.push(new READ(tnz, "A"))
            } else {
                const calling = stack.find((a, i) => a === tnz && i != stack.length - 1) ? true : tnz === this ? true : false
                if (calling) {
                    call.set(inst.push(new STACK(tnz.name, 0, 0, 0)), tnz)
                } else {
                    (tnz as Pack).convert(stack, inst, call, nep)
                }
            }
        }
        inst.push(new PUSH(this));
        for (const i of call) {
            if (i[1].id == this.id) {
                const stack = inst[i[0] - 1] as STACK
                stack.start = w
                stack.size = inst.length - w + 1
                call.delete(i[0])
            }
        }
        for (const i of nep) {
            if (i[1] == this.id) {
                (inst[i[0] - 1] as NEP).mov = i[0] - w + 1
                nep.delete(i[0])
            }
        }
        stack.pop()
        return inst
    }
    New(): Group {
        const C = new Group(this.name, this.children)
        C.features = Object.assign({}, this.features)
        return C
    }
}

export class GroupSerial extends Pack {
    type = TokenizerType.GroupSerial
    index: number = 0
    features = {}
    constructor(
        name: string,
        public children: Tokenizer[] = []
    ) {
        super(name)
    }
    convert(stack: Tokenizer[], inst: Instruction[], call: Map<number, Tokenizer>, nep: Map<number, number>): Instruction[] {
        stack.push(this)
        inst.push(new SET("B", 0))
        inst.push(new SIT(0))
        inst.push(new SET("B", 1))
        const w = inst.push(new POP())
        for (let i = this.children.length - 1; i >= 0; i--) {
            const tnz = this.children[i]
            inst.push(new SIT(inst.length - w))
            inst.push(new SADD())
            if (tnz.type == TokenizerType.Reader) {
                inst.push(new CMP("A", 1))
                inst.push(new READ(tnz, "A"))
            } else {
                const calling = stack.find((a, i) => a === tnz && i != stack.length - 1) ? true : tnz === this ? true : false
                if (calling) {
                    call.set(inst.push(new STACK(tnz.name, 0, 0, 0)), tnz)
                } else {
                    (tnz as Pack).convert(stack, inst, call, nep)
                }
            }
        }
        inst.push(new PUSH(this));
        (inst[w - 3] as SIT).mov = w - inst.length - 3
        for (const i of call) {
            if (i[1].id == this.id) {
                const stack = inst[i[0] - 1] as STACK
                stack.start = w
                stack.size = inst.length - w + 1
                call.delete(i[0])
            }
        }
        for (const i of nep) {
            if (i[1] == this.id) {
                (inst[i[0] - 1] as NEP).mov = i[0] - w + 1
                nep.delete(i[0])
            }
        }
        stack.pop()
        return inst
    }
    New(): GroupSerial {
        const C = new GroupSerial(this.name, this.children)
        C.features = Object.assign({}, this.features)
        return C
    }
}
