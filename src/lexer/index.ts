import { Input } from "../input";
import { is_pack, Lexer, Span, Token, Tokenizer } from "../interface";
import { Group, GroupSerial, IFWrapper, Merger, Pack, Reader, Wrapper, WrapperSerial } from "../tokenizer";
import { SyntaxError } from "./error";
import { DepthDebug } from "./debug";
import chalk from "chalk";
// import chalk from "chalk";

export class LexerBase<MappedToken> implements Lexer<MappedToken> {
    queue: Tokenizer[] = [];
    tokens: (Token | MappedToken)[] = [];
    index: number = 0;
    disable_debugger: boolean = true
    tokenMapper?: (name: string, value: string, span: Span) => MappedToken

    constructor(
        public source: Input,
        public scheme: Tokenizer[]
    ) {
    }
    next() {
        return this.tokens[++this.index]
    }

    get(i: number = 0) {
        return this.tokens[this.index + i]
    }
    read(source?: Input) {
        if (source) {
            this.source = source
        }
        while (!this.source.eof()) {
            for (const tnz of this.scheme) {
                if (tnz.type == "Reader") {
                    if (tnz.test(this)) {
                        const result = tnz.read(this)
                        if (!tnz.options.ignore) {
                            this.tokens.push(result)
                        }
                        if (tnz.options.mode == 'push') {
                            this.queue.unshift(tnz.options.tokenizer)
                        }
                    }
                } else if (is_pack(tnz)) {
                    const result = this._read(tnz)
                    if (result) {
                        for (let i = 0; i < result.length; i++) {
                            this.tokens.push(result[i])
                        }
                    }
                }
            }
            this.source.wreak_havoc({
                err: new Error("No matched syntax: " + chalk.underline(this.source.pan([0, 100], true)))
            })
        }
    }

    private add_merger(tokens: Token[], tnz: Tokenizer) {
        if (is_pack(tnz)) {
            const _ = tnz as Pack
            if (_.merging && !_.merger) {
                _.merger = new Merger(_.name, tokens.length + 0)
            }
        }
    }

    private _read(scheme: Tokenizer): (Token|MappedToken)[] | undefined {
        const tokens: Token[] = []
        const stack: Tokenizer[] = []
        const debug = new DepthDebug(this.disable_debugger)
        let step = 0

        const tnz = scheme.clone()
        debug.push(tnz.name)
        if (tnz.type == "Reader") {
            if (tnz.test(this)) {
                const result = tnz.read(this)
                if (!tnz.options.ignore) {
                    tokens.push(result)
                }
                if (tnz.options.mode == "push") {
                    stack.push(tnz.options.tokenizer.clone())
                }
                if (tnz.options.mode == "pop") {
                    throw new Error('NO STACK TO POP')
                }
            } else {
                return undefined
            }
        }

        const index_stack: number[] = [0]
        const push_stack: number[] = []

        if (is_pack(tnz)) {
            this.add_merger(tokens, tnz)
            stack.push(tnz)
            for (let i = (tnz as Pack).children.length - 1; i >= 0; i--) {
                const child = (tnz as Pack).children[i].clone()
                child.parent = (tnz as Pack)
                stack.push(child)
            }
        }

        function pop_test<T>(value: T | undefined) {
            return (error: string) => {
                if (value !== undefined) {
                    return value
                } else {
                    throw new Error(error)
                }
            }
        }

        let last_failed: Tokenizer | undefined

        while (stack.length > 0) {
            debug.depth = index_stack.length
            debug.log(stack.map(a => a.type == 'Reader' ? chalk.blue(a.name) : chalk.red(a.name)).join(' '), stack.length)
            // debug.log(stack.map(a => a.name).join(' '), stack.length, index_stack)
            const tnz = stack.pop()!
            if (tnz.type == "Reader") {
                debug.log('test reader -', tnz.name, tnz.test(this))
                if (tnz.test(this)) {
                    // Testing passed
                    // console.log(index_stack)
                    const result = tnz.read(this)
                    if (!tnz.options.ignore) {
                        tokens.push(result)
                    }
                    if (tnz.options.mode == "push") {
                        const clone = tnz.options.tokenizer.clone()
                        clone.parent = tnz.parent
                        push_stack.push(index_stack[index_stack.length - 1])
                        stack.push(clone)
                        debug.push('push -', clone.name)
                    }
                    if (tnz.options.mode == "pop") {
                        const i = pop_test<number>(push_stack.pop())('ERROR')
                        const j = index_stack.length - index_stack.findIndex((a) => a == i) - 1
                        // console.log(i)
                        for (let i = 0; i < j; i++) {
                            index_stack.pop()
                            const tnz = stack.pop()!
                            if (tnz.parent) {
                                tnz.parent.status = "succeed"
                                tnz.parent.next()
                            }
                            debug.pop('pop', tnz.name, tnz.parent ? true : false)
                        }
                        debug.pop('pop')
                    }
                    // feedback to parent
                    if (tnz.parent) {
                        const parent = tnz.parent
                        // Wrapper
                        if (parent.type == "Wrapper") {
                            parent.next()
                        }
                        //
                        if (parent.type == "WrapperSerial") {
                            parent.next()
                        }
                        // 
                        if (parent.type == "IFWrapper") {
                            // console.log(parent.del())
                            parent.next()
                        }
                        // Group
                        if (parent.type == "Group") {
                            parent.ended = true
                            const i = pop_test<number>(index_stack.pop())("ERROR")
                            stack.splice(i)
                            debug.pop('pop - group', parent.name)
                            if (parent.parent) {
                                parent.parent.next()
                            }
                        }
                        // GroupSerial
                        if (parent.type == "GroupSerial") {
                            parent.ended = true
                            // console.log(index_stack)
                            const i = pop_test<number>(index_stack.pop())("ERROR")
                            stack.splice(i)
                            debug.pop('pop - group', parent.name)
                            const clone = parent.clone() as GroupSerial
                            clone.self_end = true
                            stack.push(clone)
                            if (parent.parent) {
                                parent.parent.next()
                            }
                        }
                        parent.status = "succeed"
                    }
                    debug.log(stack.map(a => a.name).join(' '))
                    step++
                } else {
                    // Testing failed
                    if (tnz.parent) {
                        // feedback to parent
                        const parent = tnz.parent
                        parent.status = "fail"
                        debug.log(parent.name, parent.status, tnz.options.nullable, parent.options.nullable, step)
                        if (parent.type == 'GroupSerial' || parent.type == "WrapperSerial") {
                            if (!(parent as WrapperSerial).self_end) {
                                last_failed = tnz
                            }
                        } else if (parent.type == "Wrapper" || parent.type == "Group") {
                            last_failed = tnz
                        } else {
                            last_failed = undefined
                        }
                        if (parent.type == "Wrapper" || parent.type == "WrapperSerial" || parent.type == "IFWrapper") {
                            if (parent.index > 0 && !tnz.options.nullable) {
                                // console.log(tokens.map(a => [a.raw, a.name]))
                                let i = 0
                                let is_all_if = false
                                while (i < parent.index) {
                                    is_all_if = parent.children[i].type == "IFWrapper"
                                    if (is_all_if == false) break
                                    i++
                                }
                                if (!is_all_if) {
                                    throw new SyntaxError('BRUH', this.source, tnz)
                                }
                            }
                            if (parent.options.nullable) {
                                if (tnz.options.nullable) {
                                    parent.status = "succeed"
                                }
                                if (!tnz.options.nullable) {
                                    const i = pop_test(index_stack.pop())("ERROR")
                                    stack.splice(i)
                                    debug.pop('pop TEST FAILED nullable')
                                    if (parent.parent) {
                                        parent.parent.next()
                                    }
                                }
                                parent.next()
                            }
                            if (!parent.options.nullable) {
                                if (tnz.options.nullable) {
                                    parent.next()
                                    parent.status = "succeed"
                                }
                                if (!tnz.options.nullable) {
                                    // console.log(index_stack)
                                    const i = pop_test(index_stack.pop())("ERROR")
                                    stack.splice(i)
                                    debug.pop('pop -', tnz.name, 'from error')
                                    if (parent.parent) {
                                        // console.log(parent.parent.del())
                                        if (parent.parent.type == "Group" || parent.parent.type == "GroupSerial") parent.parent.next()
                                        if (parent.parent.type == "Wrapper" || parent.parent.type == "WrapperSerial") {
                                            parent.parent.next()
                                        }
                                        parent.parent.status = "fail"
                                    }
                                    // throw new SyntaxError('unnullable unnullable wrapper 1', this.source, tnz)
                                }
                            }
                        }
                        if (parent.type == "Group") {
                            parent.next()
                        }
                        if (parent.type == "GroupSerial") {
                            parent.next()
                            // // console.log(parent)
                        }
                    } else {
                        if (!tnz.options.nullable) {
                            throw new SyntaxError('unnullable no parent', this.source, tnz)
                        }
                    }
                }
            }
            if (is_pack(tnz)) {
                const cast = tnz as Pack
                if (!cast.ended && cast.status == "unprocess") {
                    if (cast.type == "IFWrapper") {
                        debug.log('check if condition', (cast as IFWrapper).condition.regex, (cast as IFWrapper).test(this))
                        if (!(cast as IFWrapper).test(this)) {
                            if (cast.parent) {
                                cast.parent.next()
                            }
                            continue
                        }
                    }
                    if (index_stack[index_stack.length - 1] > stack.length) {
                        console.log(tokens.map(a => a.value))
                        console.log(index_stack)
                        console.log(tnz)
                        console.log(stack.map(a => a.name).join(' '), stack.length)
                        throw new Error("BRUH")
                    }
                    index_stack.push(stack.length)
                    stack.push(cast)
                    cast.status = "processing"
                    debug.push("adding -", cast.name, "children", index_stack[index_stack.length - 1])
                    this.add_merger(tokens, cast)
                    for (let i = cast.children.length - 1; i >= 0; i--) {
                        const clone = cast.children[i].clone()
                        clone.parent = cast
                        stack.push(clone)
                    }
                } else if (cast.ended) {
                    // console.log('ended', cast.name, index_stack)
                    const i = pop_test<number>(index_stack.pop())('ERROR')
                    stack.splice(i)
                    debug.log('ended')
                    debug.pop('pop -', cast.name, cast.type)
                    if (cast.merging) {
                        cast.merger?.merge(tokens)
                    }
                    if (tnz.options.mode == "push") {
                        const clone = tnz.options.tokenizer.clone()
                        clone.parent = tnz.parent
                        push_stack.push(index_stack[index_stack.length - 1])
                        stack.push(clone)
                        debug.push('push pack -', clone.name, index_stack)
                    }
                    if (tnz.options.mode == "pop") {
                        const i = pop_test<number>(push_stack.pop())('ERROR')
                        const j = index_stack.length - index_stack.findIndex((a) => a == i) - 1
                        // console.log(i)
                        for (let i = 0; i < j; i++) {
                            index_stack.pop()
                            const tnz = stack.pop()!
                            if (tnz.parent) {
                                tnz.parent.status = "succeed"
                                tnz.parent.next()
                            }
                            debug.pop('pop pack', tnz.name, tnz.parent ? true : false)
                        }
                        debug.pop('pop pack')
                    }
                    // debug.log(cast.del())
                    if (cast.parent) {
                        const parent = cast.parent
                        // console.log(parent.del(), cast.status)
                        // console.log("HIHIHIHIHIHIHIHIHIHI")
                        cast.parent.next()
                        cast.parent.status = cast.status
                        if (parent.type == "Group") {
                            parent.ended = true
                        }
                        if (parent.type == "GroupSerial") {
                            parent.ended = true
                            cast.parent.status = cast.status
                            if (cast.status == "succeed") {
                                const i = pop_test<number>(index_stack.pop())("ERROR")
                                stack.splice(i)
                                const clone = parent.clone() as GroupSerial
                                clone.self_end = true
                                clone.parent = parent.parent
                                stack.push(clone)
                            }
                        }
                        if (cast.type == "IFWrapper") {
                            // console.log("HI", cast.del(), stack.length - 1, index_stack)
                            // if ((cast as IFWrapper).stop_reading && stack.length - 1 == index_stack[index_stack.length - 1]) {
                            //     stack.splice(pop_test<number>(index_stack.pop())('ERROR') + 1)
                            //     cast.parent.ended = true
                            //     debug.log('pop from if-wrapper stop')
                            // }
                            if ((cast as IFWrapper).stop_reading && cast.parent != stack[stack.length - 1]) {
                                debug.log('pop from if-wrapper stop', index_stack)
                                stack.splice(index_stack[index_stack.length - 1] + 1)
                                cast.parent.ended = true
                                cast.parent.status = cast.status
                                // console.log(cast.del())
                                // throw new Error(cast.status)
                                // console.log(stack.map(a => a.name))
                            }
                            // console.log(index_stack, "HI", this.source.pan([-10, 1], true))
                        }
                        if (cast.type == "GroupSerial") {
                            if (cast.status == "succeed") {
                                const clone = cast.clone() as GroupSerial
                                clone.self_end = true
                                clone.parent = cast.parent
                                stack.push(clone)
                            }
                        }
                        if (cast.type == "WrapperSerial") {
                            if (cast.status == "succeed") {
                                const clone = cast.clone() as WrapperSerial
                                clone.self_end = true
                                clone.parent = cast.parent
                                stack.push(clone)
                            }
                        }
                        if (parent.parent) {
                            parent.parent.next()
                        }
                    } else {
                        if (cast.type == "Wrapper" && step > 0 && !cast.options.nullable) {
                            switch (cast.status) {
                                case "unprocess":
                                case "processing":
                                    throw new Error('pulpboard: something weird')
                                case "fail":
                                    if (last_failed) {
                                        throw new SyntaxError('unnullable no parent', this.source, last_failed)
                                    }
                                    throw new SyntaxError('unnullable no parent', this.source, tnz)
                            }
                        }
                        if (cast.type == "GroupSerial") {
                            // console.log(cast.del(), cast.status)
                            if (cast.status == "succeed") {
                                const clone = cast.clone() as GroupSerial
                                clone.self_end = true
                                clone.parent = cast.parent
                                stack.push(clone)
                            }
                        }
                        if (cast.type == "WrapperSerial") {
                            // console.log(cast.del(), cast.status)
                            if (cast.status == "succeed") {
                                const clone = cast.clone() as WrapperSerial
                                clone.self_end = true
                                clone.parent = cast.parent
                                stack.push(clone)
                            }
                        }
                    }
                    step++
                } else {
                    if (step == 0) {
                        debug.log("QUIT")
                        return
                    } else {
                        throw new SyntaxError('unexpected error that i forgot to covered', this.source, tnz)
                    }
                    // stack.push(cast)
                    // console.log(cast.del())
                    console.log("QUIT RETURN")
                    // return
                    // this should be something
                }
            }
        }
        if (this.tokenMapper) {
            return tokens.map(a => this.tokenMapper!(a.name, a.value, a.span))
        }
        return tokens
    }
}