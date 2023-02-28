import { IPack, Lexer, PackStatus, TnzOptions, TnzType, Token, Tokenizer } from "./interface";

abstract class TnzBase implements Tokenizer {
    readonly type: TnzType = "Unassign"
    name: string
    options: TnzOptions = {
        mode: 'normal',
        ignore: false,
        nullable: false,
        fragment: false
    }
    parent: Pack | undefined;

    constructor(name: string) {
        this.name = name
    }

    set(options: TnzOptions) {
        this.options = options
        return this
    }

    clone(options?: TnzOptions): Tokenizer {
        throw new Error(`Method clone in ${this.type}:${this.name} not implemented.`)
    }

    test(lexer: Lexer): boolean {
        throw new Error(`Method test in ${this.type}:${this.name} not implemented.`)
    }

    read(lexer: Lexer): Token {
        throw new Error(`Method read in ${this.type}:${this.name} not implemented.`)
    }
}


export class Reader extends TnzBase {
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

    private strip(tnz: Tokenizer) {
        const depth: string[] = []
        const stack: Tokenizer[] = [tnz]
        while (stack.length > 0) {
            const i = stack.pop()
            if (i) {
                depth.push(i.name)
                if (i.parent) {
                    stack.push(i.parent)
                }
            }
        }
        if (depth.length > 5) {
            return '...' + depth.reverse().slice(depth.length - 5).join(" > ")
        }
        return depth.reverse().join(" > ")
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

    clone(options?: TnzOptions) {
        let a = new Reader(this.name, this.regex)
        if (options) {
            a.options = options
        } else {
            a.options = this.options
        }
        return a
    }

    fragment(name: string) {
        let f = this.clone()
        f.name = name
        return f
    }
}

export class Merger {
    constructor(
        public name: string,
        public start_index: number,
    ) { }

    merge(tokens: Token[]) {
        const removed = tokens.splice(this.start_index)
        if (removed.length == 0) return;
        const raw = removed.map(a => a.value).join('')
        tokens.push(
            new Token(this.name, raw, {
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


export abstract class Pack extends TnzBase implements IPack {
    index: number = 0
    children: Tokenizer[] = []
    last_child: Tokenizer | undefined = undefined

    nullable_pop: boolean = false
    status: PackStatus = "unprocess"
    ended = false
    merging = false
    merger?: Merger

    next() {
        // console.log("next", this.name)
        if (this.index < this.children.length) {
            this.index++
        }
        if (this.index == this.children.length) {
            this.ended = true
        }
        return this.children[this.index]
    }

    add(children: Tokenizer[]) {
        if (children.length == 0) throw new Error(`${this.type} Empty`)
        const o = children.find(a => a.type == "Unassign")
        if (o) {
            throw new Error('Cannot add tokenizer type:Unassign to stack')
        }
        for (let i = 0; i < children.length; i++) {
            this.children.push(children[i])
        }
        this.last_child = this.children[this.children.length - 1]
        if (!this.nullable_pop) this.nullable_pop = children.find(a => a.options.nullable && a.options.mode == 'pop') != undefined
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
        return Object.assign(Object.assign({}, this), { children: this.children.map(a => a.name), last_child: undefined, parent: undefined })
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

    add(children: Tokenizer[]) {
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