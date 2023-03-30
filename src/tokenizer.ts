import { Input } from "./input"
import { CMP, Instruction, InstructionType, SIF, SIT, POP, PUSH, READ, SADD, SET, TEST, NEP, SKIP, ADD, ICMP } from "./instruction"
import { Address, Stack } from "./memo"

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

export interface Lexer {
    stack: Tokenizer[]
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
    ) { }
    test(lexer: Lexer): boolean {
        const m = this.regex.exec(lexer.source.to_end())
        return m ? m.index === 0 : false
    }

    match(lexer: Lexer) {
        return this.test(lexer) && this.regex.exec(lexer.source.to_end())
    }

    read(lexer: Lexer): Token {
        const match = this.match(lexer)
        const source = lexer.source
        const start_line = source.line + 0
        const start_col = source.column + 0
        if (match) {
            const start = source.index
            const end = start + match[0].length + 0
            const value = source.seek(match[0].length)
            return new Token(this.name, value, {
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
    compile() {
        const self = this.New()
        const inst = new Stack<Instruction>()
        const stack = new Stack<Tokenizer>([self])
        const ref = new Map<number, number>()
        const resume: number[] = []
        const skip: number[] = []
        const stop: [number, number, number][] = []
        ref.set(self.id, 0)
        while (stack.size > 0) {
            const parent = stack.get() as any
            if (parent.type == TokenizerType.Reader) {
                inst.add(new READ(parent, "A"))
            } else {
                if (parent.index == 0) {
                    ref.set(parent.id, inst.size)
                }
                switch (parent.type) {
                    case TokenizerType.Wrapper:
                        {
                            if (parent.index == 0) {
                                if (ref.get(parent.id) && (parent.children as Array<Tokenizer>).filter((a, i) => i > parent.index && ref.get(a.id)).length > 0) {
                                    inst.add([
                                        new POP(),
                                        new CMP(new Address('m' + ref.size.toString()), 0),
                                        new SIT(9),
                                        new ICMP(0),
                                        new SIT(4),
                                        new ICMP(0),
                                        new SIT(2),
                                        new POP(),
                                        new SIF(-6),
                                        new ADD(new Address('m' + ref.size.toString(), -1)),
                                        new CMP(new Address('m' + ref.size.toString()), -1),
                                        new SIF(0)
                                    ])
                                } else inst.add(new POP())
                            }
                            for (; parent.index < parent.children.length; parent.index++) {
                                const item = parent.children[parent.children.length - parent.index - 1]
                                if (item.type == TokenizerType.Reader) {
                                    const inst_: Instruction[] = []
                                    if (item.features["nullable"] == true) {
                                        inst_.push(
                                            new READ(item, "A"),
                                        )
                                    } else {
                                        inst_.push(
                                            new READ(item, "A"),
                                            new CMP(new Address("A"), 1),
                                        )
                                    }
                                    if (resume.length > 0) {
                                        inst_.push(new SIF(inst.size - ref.get(parent.id)! - 11), new SADD())
                                    } else {
                                        inst_.push(new SIF(inst.size - ref.get(parent.id)!), new SADD())
                                    }
                                    inst.add(inst_)
                                } else {
                                    if (item.type == TokenizerType.IFWrapper) {
                                        inst.add(new SADD())
                                        stack.add(item.New())
                                        break
                                    } else {
                                        if (ref.get(item.id)) {
                                            resume.push(inst.size)
                                            inst.add(new SADD())
                                            skip.push(inst.size)
                                            inst.add(new SKIP(0))
                                            inst.add(new ADD(new Address('m' + ref.size.toString(), 1)))
                                        } else {
                                            inst.add(new SADD())
                                            stack.add(item)
                                            break
                                        }
                                    }
                                }
                            }
                            if (parent.index == parent.children.length) {
                                inst.add([new PUSH(parent)]);
                                if (resume.length) {
                                    (inst.array[ref.get(parent.id)!] as any).mov = ref.get(parent.id)! - resume.pop()!
                                }
                                if (skip.length > 0) {
                                    const SKIP = skip.pop() as unknown as number
                                    const t = stack.array.filter(a => a.name == parent.name && a.id != parent.id).slice(-1)[0];

                                    (inst.array[SKIP] as any).mov = -(inst.size - SKIP + 1);
                                    (inst.array[ref.get(parent.id)! + 6] as any).id = parent.id;
                                    (inst.array[ref.get(parent.id)! + 8] as any).id = t.id;
                                }
                            }
                        }
                        break
                    case TokenizerType.IFWrapper:
                        {
                            if (parent.index == 0) {
                                ref.set(parent.id, inst.size)
                                if ((parent.features as any).stop) {
                                    inst.add([
                                        new POP(),
                                        new SIF(1),
                                        new NEP(0),
                                    ])
                                } else {
                                    inst.add([
                                        new POP()
                                    ])
                                }
                            }
                            for (; parent.index < parent.children.length; parent.index++) {
                                const item = parent.children[parent.children.length - parent.index - 1]
                                if (item.type == TokenizerType.Reader) {
                                    const inst_: Instruction[] = []
                                    if (item.features["nullable"] == true) {
                                        inst_.push(
                                            new READ(item, "A"),
                                        )
                                    } else {
                                        inst_.push(
                                            new READ(item, "A"),
                                            new CMP(new Address("A"), 1),
                                        )
                                    }
                                    inst_.push(new SIF(inst.size - ref.get(parent.id)!), new SADD())
                                    inst.add(inst_)
                                } else {
                                    if (ref.get(item.id)) {
                                        resume.push(inst.size)
                                        inst.add(new SADD())
                                        skip.push(inst.size)
                                        inst.add(new SKIP(0))
                                        inst.add(new ADD(new Address('m' + ref.size.toString(), 1)))
                                    } else {
                                        inst.add(new SADD())
                                        inst.add(new SIF(inst.size - ref.get(parent.id)!))
                                        stack.add(item.type == TokenizerType.IFWrapper ? item.New() : item)
                                        break
                                    }
                                }
                            }
                            if (parent.index == parent.children.length) {
                                inst.add([new PUSH(parent)]);
                                inst.add([new SIF(inst.size - ref.get(parent.id)!)])
                                inst.add([new CMP(new Address("A"), 1)])
                                inst.add([new TEST(parent.condition, "A")]);
                                if ((parent.features as any).stop) {
                                    stop.push([
                                        stack.get(stack.size > 1 ? -1 : 0)!.id + 0,
                                        parent.id + 0,
                                        inst.size + 0
                                    ])
                                }
                            }
                        }
                        break
                    case TokenizerType.WrapperSerial:
                        {
                            for (; parent.index < parent.children.length; parent.index++) {
                                const item = parent.children[parent.children.length - parent.index - 1]
                            }
                        }
                        break
                    case TokenizerType.Group:
                        {
                            if (parent.index == 0) {
                                inst.add([
                                    new POP(),
                                ])
                            }
                            for (; parent.index < parent.children.length; parent.index++) {
                                const item = parent.children[parent.children.length - parent.index - 1]
                                if (item.type == TokenizerType.Reader) {
                                    const inst_: Instruction[] = []
                                    if (item.features["nullable"] == true) {
                                        inst_.push(
                                            new READ(item, "A"),
                                        )
                                    } else {
                                        inst_.push(
                                            new READ(item, "A"),
                                            new CMP(new Address("A"), 1),
                                        )
                                    }
                                    inst_.push(
                                        new SIT(inst.size - 1 - ref.get(parent.id)!),
                                        new SADD(),
                                    )
                                    inst.add(inst_)
                                } else {
                                    if (ref.get(item.id)) {
                                        throw new Error("Method not implemented.")
                                    } else {
                                        inst.add([
                                            new SIT(inst.size - 1 - ref.get(parent.id)!),
                                            new SADD(),
                                        ])
                                        stack.add(item)
                                        ref.set(item.id, inst.size)
                                        break
                                    }
                                }
                            }
                            if (parent.index == parent.children.length) {
                                inst.add([new PUSH(parent)]);
                            }
                        }
                        break
                    case TokenizerType.GroupSerial:
                        {
                            if (parent.index == 0) {
                                inst.add([
                                    new SIF(1),
                                    new SET(new Address("B", 1)),
                                    new POP(),
                                    new CMP(new Address("B"), 1),
                                    new SET(new Address("B", 0)),
                                    new SIT(0),
                                ])
                            }
                            for (; parent.index < parent.children.length; parent.index++) {
                                const item = parent.children[parent.children.length - parent.index - 1]
                                if (item.type == TokenizerType.Reader) {
                                    const inst_: Instruction[] = []
                                    if (item.features["nullable"] == true) {
                                        inst_.push(
                                            new READ(item, "A"),
                                        )
                                    } else {
                                        inst_.push(
                                            new READ(item, "A"),
                                            new CMP(new Address("A"), 1),
                                        )
                                    }
                                    inst_.push(
                                        new SIT(inst.size - 1 - ref.get(parent.id)!),
                                        new SADD(),
                                    )
                                    inst.add(inst_)
                                } else {
                                    if (ref.get(item.id)) {
                                        throw new Error("Method not implemented.")
                                    } else {
                                        inst.add([
                                            new SIT(inst.size - 5 - ref.get(parent.id)!),
                                            new SADD(),
                                        ])
                                        stack.add(item)
                                        ref.set(item.id, inst.size)
                                        break
                                    }
                                }
                            }
                            if (parent.index == parent.children.length) {
                                inst.add([new PUSH(parent)]);
                                const w = inst.array[ref.get(parent.id)!] as any;
                                w.mov = -(inst.size - ref.get(parent.id)!)
                            }
                        }
                        break
                }
                // console.log(stack)
                // console.log(parent.index,parent.children.length)
                if (parent.index == parent.children.length) {
                    parent.index = 0
                    // console.log(stack.array.map(a => (a as any).index))
                    stack.pop();
                    if (stop.length) {
                        if (stop[stop.length - 1][0] == parent.id) {
                            // console.log(inst)
                            const i = stop.pop()!;
                            // console.log(ref.get(i[0])!);
                            (inst.array[ref.get(i[1])!] as any).mov = ref.get(i[1])! - ref.get(i[0])! + 0
                        }
                    }
                    if (stack.size) {
                        (stack.get() as any).index++
                    }
                }
            }
        }
        // let k = 0
        // console.log([...inst.array].reverse().map((a) => {
        //     if (a.type == InstructionType.PUSH) k++
        //     if (a.type == InstructionType.POP) k--
        //     return new Array(k + (a.type == InstructionType.PUSH ? -1 : 0)).fill('    ').join('') + a.constructor.name + ' ' + a.str()
        // }).join("\n"))
        // throw new Error
        return inst
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
}

export class Wrapper extends Pack {
    type = TokenizerType.Wrapper
    index: number = 0
    features = {}
    constructor(
        name: string,
        public children: Tokenizer[] = []
    ) {
        super(name)
    }
    // compile() {
    //     const inst = new Stack<Instruction>([
    //         new POP()
    //     ])
    //     for (let i = this.children.length - 1; i >= 0; i--) {
    //         const item = (this.children[i] as any).New() // circular calling protection
    //         if (item.type == TokenizerType.Reader) {
    //             const inst_: Instruction[] = []
    //             if (item.features["nullable"] == true) {
    //                 inst_.push(
    //                     new READ(item, "A"),
    //                 )
    //             } else {
    //                 inst_.push(
    //                     new READ(item, "A"),
    //                     new CMP(new Address("A"), 1),
    //                 )
    //             }
    //             inst_.push(new SIT(1), new SIF(inst.size), new SADD())
    //             inst.add(inst_)
    //         } else {
    //             inst.add_direct(new SADD())
    //             inst.add_direct(item.New().compile().array)
    //         }
    //     }
    //     inst.add([new PUSH(this)])
    //     // console.log(inst)
    //     return inst
    // }
    New(): Wrapper {
        const C = new Wrapper(this.name, this.children)
        C.features = Object.assign({}, this.features)
        return C
    }
}

export class IFWrapper extends Pack {
    type = TokenizerType.IFWrapper
    index: number = 0
    features = {}
    constructor(
        name: string,
        public condition: Reader,
        public children: Tokenizer[] = [],
    ) {
        super(name)
    }
    // compile() {
    //     const inst = new Stack<Instruction>()
    //     if ((this.features as any).stop) {
    //         inst.add([
    //             new POP(),
    //             new SIF(1),
    //             new NEP(),
    //         ])
    //     } else {
    //         inst.add([
    //             new POP()
    //         ])
    //     }
    //     for (let i = this.children.length - 1; i >= 0; i--) {
    //         const item = (this.children[i] as any).New() // circular calling protection
    //         if (item.type == TokenizerType.Reader) {
    //             const inst_: Instruction[] = []
    //             if (item.features["nullable"] == true) {
    //                 inst_.push(
    //                     new READ(item, "A"),
    //                 )
    //             } else {
    //                 inst_.push(
    //                     new READ(item, "A"),
    //                     new CMP(new Address("A"), 1),
    //                 )
    //             }
    //             inst_.push(new SIT(1), new SIF(inst.size), new SADD())
    //             inst.add(inst_)
    //         } else {
    //             inst.add_direct(new SADD())
    //             inst.add_direct(item.New().compile().array)
    //         }
    //     }
    //     inst.add([new PUSH(this)])
    //     inst.add([new SIF(inst.size)])
    //     inst.add([new CMP(new Address("A"), 1)])
    //     inst.add([new TEST(this.condition, "A")])
    //     // console.log(inst)
    //     return inst
    // }
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
    // compile() {
    //     // inst.add_direct(new SIT(1))
    //     // inst.add_direct(new CMP(new Address('B'), 1))
    //     const inst = new Stack<Instruction>([
    //         new POP(),
    //         new CMP(new Address("A"), 1),
    //         new SET(new Address("B", 1)),
    //         new SIT(0),
    //     ])
    //     for (let i = this.children.length - 1; i >= 0; i--) {
    //         const item = (this.children[i] as any).New() // circular calling protection
    //         if (item.type == TokenizerType.Reader) {
    //             const inst_: Instruction[] = []
    //             if (item.features["nullable"] == true) {
    //                 inst_.push(
    //                     new READ(item, "A"),
    //                 )
    //             } else {
    //                 inst_.push(
    //                     new READ(item, "A"),
    //                     new CMP(new Address("A"), 1),
    //                 )
    //             }
    //             inst_.push(new SIT(1), new SIF(inst.size - 3), new SADD())
    //             inst.add(inst_)
    //         } else {
    //             inst.add_direct(new SADD())
    //             inst.add_direct(item.New().compile().array)
    //         }
    //     }
    //     inst.add([new PUSH(this)]);
    //     (inst.array[0] as any).mov = -inst.size
    //     // console.log([...inst.array].reverse().map((a) => a.constructor.name + ' ' + a.str()).join("\n"))
    //     // console.log("YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY")
    //     return inst
    // }
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
    // compile() {
    //     const inst = new Stack<Instruction>([
    //         new POP(),
    //     ])
    //     for (let i = this.children.length - 1; i >= 0; i--) {
    //         const item = (this.children[i] as any).New()
    //         if (item.type == TokenizerType.Reader) {
    //             const inst_: Instruction[] = []
    //             if (item.features["nullable"] == true) {
    //                 inst_.push(
    //                     new SADD(),
    //                     new READ(item, "A"),
    //                 )
    //             } else {
    //                 inst_.push(
    //                     new SADD(),
    //                     new READ(item, "A"),
    //                     new CMP(new Address("A"), 1),
    //                 )
    //             }
    //             inst_.push(new SIT(inst.size - 1))
    //             inst.add(inst_)
    //         } else {
    //             inst.add_direct(new SADD())
    //             inst.add_direct(item.New().compile().array)
    //         }
    //     }
    //     inst.add([new PUSH(this)])
    //     return inst
    // }
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
    // compile() {
    //     const inst = new Stack<Instruction>([
    //         new POP(),
    //         new CMP(new Address("A"), 1),
    //         new SET(new Address("B", 1)),
    //         new SIT(0),
    //     ])
    //     for (let i = this.children.length - 1; i >= 0; i--) {
    //         const item = (this.children[i] as any).New()
    //         if (item.type == TokenizerType.Reader) {
    //             const inst_: Instruction[] = []
    //             if (item.features["nullable"] == true) {
    //                 inst_.push(
    //                     new SADD(),
    //                     new READ(item, "A"),
    //                 )
    //             } else {
    //                 inst_.push(
    //                     new SADD(),
    //                     new READ(item, "A"),
    //                     new CMP(new Address("A"), 1),
    //                 )
    //             }
    //             inst_.push(new SIT(inst.size - 1))
    //             inst.add(inst_)
    //         } else {
    //             inst.add_direct(new SADD())
    //             inst.add_direct(item.New().compile().array)
    //         }
    //     }
    //     inst.add([new PUSH(this)]);
    //     (inst.array[0] as any).mov = -inst.size
    //     return inst
    // }
    New(): GroupSerial {
        const C = new GroupSerial(this.name, this.children)
        C.features = Object.assign({}, this.features)
        return C
    }
}
