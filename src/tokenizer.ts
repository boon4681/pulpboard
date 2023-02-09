import { Input } from "./input"

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

export class Token<A> {
    name: string
    raw: string
    value: A
    span: Span

    constructor(name: string, raw: string, value: A, span: Span) {
        this.name = name
        this.raw = raw
        this.span = span
        this.value = value
    }
}

export interface TnzOptionsNormal {
    mode: "normal"
    fragment: boolean
    ignore: boolean
    nullable: boolean
}

export interface TnzOptionsPush {
    mode: "push"
    ignore: boolean
    nullable: boolean
    tokenizer: Tokenizer<any, any>
}

export interface TnzOptionsPop {
    mode: "pop"
    ignore: boolean
    nullable: boolean
}

export type TnzOptions = TnzOptionsNormal | TnzOptionsPush | TnzOptionsPop

export enum _PackStatus {
    succeed,
    fail,
    unprocess
}

enum _TnzType {
    Unassign,
    Reader,
    Wrapper,
    WrapperSerial,
    IFWrapper,
    Group,
    GroupSerial,
    CUSTOM
}

export type TnzType = keyof typeof _TnzType;
export type PackStatus = keyof typeof _PackStatus;

export function is_pack(tnz: Tokenizer<any, any>) {
    return (["Group", "GroupSerial", "Wrapper", "IFWrapper", "WrapperSerial"] as TnzType[]).includes(tnz.type)
}

export interface Tokenizer<A, B> {
    type: TnzType;
    name: string;
    parent: Tokenizer<any, any> | undefined
    readonly casting: boolean

    options: TnzOptions

    test(lexer: Lexer): boolean
    read(lexer: Lexer): Token<A>
    set(options: TnzOptions): Tokenizer<A, B>
    clone(options?: TnzOptions): Tokenizer<A, B>
}

export interface Lexer {
    queue: Tokenizer<string, any>[]
    scheme: Tokenizer<string, any>[]
    tokens: Token<any>[]
    source: Input
}

abstract class TnzBase<A, B> implements Tokenizer<A, B> {
    readonly type: TnzType = "Unassign"
    name: string
    options: TnzOptions = {
        mode: 'normal',
        ignore: false,
        nullable: false,
        fragment: false
    }
    parent: Tokenizer<any, any> | undefined;

    readonly casting: boolean = false;

    constructor(name: string) {
        this.name = name
    }

    set(options: TnzOptions) {
        this.options = options
        return this
    }

    clone(options?: TnzOptions): Tokenizer<A, B> {
        throw new Error(`Method clone in ${this.type}:${this.name} not implemented.`)
    }

    test(lexer: Lexer): boolean {
        throw new Error(`Method test in ${this.type}:${this.name} not implemented.`)
    }

    read(lexer: Lexer): Token<A> {
        throw new Error(`Method read in ${this.type}:${this.name} not implemented.`)
    }
}

export class Reader extends TnzBase<string, string> {
    readonly type: TnzType = "Reader"
    regex: RegExp

    constructor(name: string, regex: RegExp) {
        super(name)
        this.regex = regex
    }

    test(lexer: Lexer): boolean {
        const m = this.regex.exec(lexer.source.to_end())
        return m ? m.index === 0 : false
    }

    match(lexer: Lexer) {
        return this.test(lexer) && this.regex.exec(lexer.source.to_end())
    }

    read(lexer: Lexer): Token<string> {
        const match = this.match(lexer)
        const source = lexer.source
        const start_line = source.line + 0
        const start_col = source.column + 0
        if (match) {
            const start = source.index
            const end = start + match[0].length + 0
            const value = source.seek(match[0].length)
            return new Token<string>(this.name, value, this.cast(value), {
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

    cast(value: string): string {
        return value
    }

    clone(options?: TnzOptions) {
        let a = new Reader(this.name, this.regex)
        if (options) {
            a.options = options
        } else {
            a.options = this.options
        }
        return a
    }
}

export class Merger {
    constructor(
        public name: string,
        public start_index: number,
    ) { }

    merge(tokens: Token<any>[]) {
        const removed = tokens.splice(this.start_index)
        if (removed.length == 0) return;
        const raw = removed.map(a => a.raw).join('')
        tokens.push(
            new Token<string>(this.name, raw, raw, {
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

export abstract class Pack extends TnzBase<string, string>{
    index: number = 0
    children: Tokenizer<string, any>[] = []
    last_child: Tokenizer<string, any> | undefined = undefined

    nullable_pop: boolean = false
    status: PackStatus = "unprocess"
    ended = false
    merging = false
    merger?: Merger

    merge(tokens: Token<any>[]) {
        if (!this.merging) {
            throw new Error(`Method merge in ${this.type}:${this.name} not implemented.`)
        }
        this.merger?.merge(tokens)
    }

    update() {
        if (this.index == this.children.length) {
            this.ended = true
        }
    }

    next() {
        if (this.index < this.children.length) {
            this.index++
        }
        this.update()
    }

    add(children: Tokenizer<string, any>[]) {
        if (children.length == 0) throw new Error(`${this.type} Empty`)
        const u = children.find(a => a.type == "CUSTOM")
        if (u) {
            throw new Error('Tokenizer type:CUSTOM is not support')
        }
        const o = children.find(a => a.type == "Unassign")
        if (o) {
            throw new Error('Cannot add tokenizer type:Unassign to stack')
        }
        this.children.push(...children)
        this.last_child = this.children[this.children.length - 1]
        if (!this.nullable_pop) this.nullable_pop = children.find(a => a.options.nullable == true && a.options.mode == 'pop') != undefined
        return this
    }

    get(index?: number) {
        if (index) return this.children[index]
        return this.children[this.index]
    }

    protected clone_attr(tnz: Pack) {
        tnz.merging = this.merging
    }

    del() {
        const u = Object.assign(Object.assign({}, this), { children: undefined, last_child: undefined, parent: undefined })
        return u
    }
}

export class Wrapper extends Pack {
    readonly type: TnzType = "Wrapper"

    clone(options?: TnzOptions) {
        let a = new Wrapper(this.name)
        a.add(this.children)
        if (options) {
            a.options = options
        } else {
            a.options = this.options
        }
        this.clone_attr(a)
        return a
    }
}

export class WrapperSerial extends Pack {
    readonly type: TnzType = "WrapperSerial"

    self_end: boolean = false

    clone(options?: TnzOptions) {
        let a = new WrapperSerial(this.name)
        a.add(this.children)
        if (options) {
            a.options = options
        } else {
            a.options = this.options
        }
        this.clone_attr(a)
        return a
    }
}

export class IFWrapper extends Pack {
    readonly type: TnzType = "IFWrapper"

    constructor(
        name: string,
        public condition: Reader
    ) {
        super(name)
    }

    test(lexer: Lexer): boolean {
        return this.condition.test(lexer)
    }

    clone(options?: TnzOptions) {
        let a = new IFWrapper(this.name, this.condition)
        a.add(this.children)
        if (options) {
            a.options = options
        } else {
            a.options = this.options
        }
        this.clone_attr(a)
        a.stop(this.stop_reading)
        return a
    }

    stop_reading = false

    stop(stop: boolean) {
        this.stop_reading = stop
        return this
    }
}

export class Group extends Pack {
    readonly type: TnzType = "Group"

    add(children: Tokenizer<string, any>[]) {
        super.add(
            // sorted array to increase performance
            children.sort((a: any, b: any) => {
                if (a.type == "Reader" && b.type == "Reader") {
                    return 0
                }
                if (a.type == "Reader") {
                    return -1
                }
                if (b.type == "Reader") {
                    return 1
                }
                return 0
            })
        )
        return this
    }

    clone(options?: TnzOptions) {
        let a = new Group(this.name)
        a.add(this.children)
        if (options) {
            a.options = options
        } else {
            a.options = this.options
        }
        this.clone_attr(a)
        return a
    }
}

export class GroupSerial extends Group {
    readonly type: TnzType = "GroupSerial"

    self_end: boolean = false

    clone(options?: TnzOptions) {
        let a = new GroupSerial(this.name)
        a.add(this.children)
        if (options) {
            a.options = options
        } else {
            a.options = this.options
        }
        this.clone_attr(a)
        return a
    }
}