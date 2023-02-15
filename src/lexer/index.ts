
import { Input } from "../input"
import { Group, GroupSerial, IFWrapper, is_pack, Lexer, Merger, Pack, Reader, Token, Tokenizer, Wrapper, WrapperSerial } from "../tokenizer"
import { DepthDebug } from "./debug"
import { ifwrapper } from "./base/ifwrapper"
import { reader } from "./base/reader"
import { Stacker } from "./stacker"
import { wrapper } from "./base/wrapper"
import { wrapper_serial } from "./base/wrapper_serial"
import { group_serial } from "./base/group_serial"
import { group } from "./base/group"

export abstract class LexerBase implements Lexer {

    queue: Tokenizer<string, any>[] = []
    scheme: Tokenizer<string, any>[] = []

    tokens: Token<any>[] = []

    disable_debugger = true
    update = 0
    index = 0

    constructor(public source: Input, scheme: Tokenizer<string, any>[]) {
        this.scheme = scheme
    }

    run() {
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
                    const result = this.read(tnz)
                    if (result) {
                        if (result.state) {
                            this.source.set(result.state)
                        }
                        for (let i = 0; i < result.tokens.length; i++) {
                            this.tokens.push(result.tokens[i])
                        }
                    }
                }
            }
            this.source.wreak_havoc({
                err: new Error(`No viable alternative.\n${this.source.pan([-100, 1], true)}<- no lexer`)
            })
        }
        // console.log(this.update,this.source.size)
    }

    private add_merger(tokens: Token<any>[], tnz: Tokenizer<string, any>) {
        if (is_pack(tnz)) {
            const _ = tnz as Pack
            if (_.merging && !_.merger) {
                _.merger = new Merger(_.name, tokens.length + 0)
            }
        }
    }

    private read(tnz: Tokenizer<string, any>) {
        const debug = new DepthDebug(this.disable_debugger)
        const stack: Stacker = new Stacker(debug)
        const tokens: Token<any>[] = []

        const clone = tnz.clone()
        this.add_merger(tokens, clone)
        stack.push(clone)


        this.source.push()
        while (stack.children.length > 0) {
            const tnz = stack.last()
            if (tnz) {
                if (tnz.type == "Reader") {
                    const result = reader(this, tokens, stack, debug, tnz as Reader)
                    if (result != undefined) {
                        return result
                    }
                }

                if (tnz.type == "Wrapper") {
                    const result = wrapper(this, tokens, stack, debug, tnz as Wrapper)
                    if (result != undefined) {
                        return result
                    }
                }

                if (tnz.type == "IFWrapper") {
                    const result = ifwrapper(this, tokens, stack, debug, tnz as IFWrapper)
                    if (result != undefined) {
                        return result
                    }
                }

                if (tnz.type == "WrapperSerial") {
                    const result = wrapper_serial(this, tokens, stack, debug, tnz as WrapperSerial)
                    if (result != undefined) {
                        return result
                    }
                }

                if (tnz.type == "Group") {
                    const result = group(this, tokens, stack, debug, tnz as Group)
                    if (result != undefined) {
                        return result
                    }
                }

                if (tnz.type == "GroupSerial") {
                    const result = group_serial(this, tokens, stack, debug, tnz as GroupSerial)
                    if (result != undefined) {
                        return result
                    }
                }

                if (is_pack(tnz)) {
                    const _ = (tnz as Pack)
                    if (_.merging && _.ended) {
                        _.merge(tokens)
                    }
                }
            }

            stack.wreak_havoc(this)
        }
        this.update += stack.step
        return { tokens, state: this.source.pop() };
    }
}