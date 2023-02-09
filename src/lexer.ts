
import { Input } from "./input"
import { Group, is_pack, Lexer, Merger, Pack, Token, Tokenizer, Wrapper } from "./tokenizer"

class DepthDebug {
    depth: number = 0

    constructor(public disable: boolean) { }

    log(...arg: any) {
        if (this.disable) return;
        if (arg.length == 0) return;

        const u = arg.map((a: any) => {
            // if (typeof a == "object") {
            //     return JSON.stringify(a)
            // }
            return a
        })
        if (this.depth == 0) {
            console.log(...u)
        } else if (this.depth == 1) {
            console.log(' ', ...u)
        } else {
            console.log(new Array(this.depth).fill("").join("    "), ...u)
        }
    }

    lpp(...arg: any) {
        if (arg.length == 0) return;
        this.depth += 1
        this.log(...arg)
        this.depth -= 1
    }

    push(...arg: any) {
        this.depth += 1
        this.log(...arg)
    }

    pop(...arg: any) {
        this.log(...arg)
        this.depth -= 1
    }
}

class Stacker {
    step: number = 0
    private update: number = 0

    children: Tokenizer<any, any>[] = []

    wreak_havoc() {
        if (this.update == this.step) {
            throw new Error(`Lexer cannot eat tokenizer "${this.last().name}"`)
        }
        this.update = this.step
    }

    last() {
        return this.children[this.children.length - 1]
    }

    push(...children: Tokenizer<any, any>[]) {
        this.step++
        return this.children.push(...children)
    }

    pop() {
        this.step++
        return this.children.pop()
    }
}

export abstract class LexerBase implements Lexer {

    queue: Tokenizer<string, any>[] = []
    stack: Tokenizer<string, any>[] = []

    tokens: Token<any>[] = []

    constructor(public source: Input, stack: Tokenizer<string, any>[]) {
        this.stack = stack
        while (!this.source.eof()) {
            for (const tnz of this.stack) {
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
                }
                if (is_pack(tnz)) {
                    const result = this.read(tnz)
                    if (result) {
                        if (result.state) {
                            source.set(result.state)
                        }
                        this.tokens.push(...result.tokens)
                    }
                }
            }
            source.wreak_havoc()
        }
    }

    private strip(tnz: Tokenizer<any, any>) {
        const depth: string[] = []
        const stack: Tokenizer<any, any>[] = [tnz]
        while (stack.length > 0) {
            const i = stack.pop()
            if (i) {
                depth.push(i.name)
                if (i.parent) {
                    stack.push(i.parent)
                }
            }
        }
        return depth.reverse().join(" > ")
    }

    private add_merger(tokens: Token<any>[], tnz: Tokenizer<string, any>) {
        if (is_pack(tnz)) {
            const _ = tnz as Pack
            if (_.merging == true && !_.merger) {
                _.merger = new Merger(_.name, tokens.length + 0)
            }
        }
    }

    read(tnz: Tokenizer<string, any>) {
        const stack: Stacker = new Stacker()
        let push_stack: number = 0
        const tokens: Token<any>[] = []

        const clone = tnz.clone()
        this.add_merger(tokens, clone)
        stack.push(clone)

        this.source.push()
        const debug = new DepthDebug(true)
        while (stack.children.length > 0) {
            const tnz = stack.last()
            debug.log(tnz.name)
            if (tnz) {
                if (tnz.type == "Reader") {
                    if (tnz.test(this)) {
                        const result = tnz.read(this)
                        if (!tnz.options.ignore) {
                            tokens.push(result)
                        }
                        if (tnz.options.mode == 'push') {
                            const clone = tnz.options.tokenizer.clone()
                            stack.push(clone);
                            this.add_merger(tokens, clone)
                            debug.push()
                            push_stack++
                        }
                        if (tnz.options.mode == 'pop') {
                            throw new Error(`No stack to pop ${tnz.name}`)
                        }
                    } else if (tnz.options.nullable == false) {
                        this.source.pop()
                        return false
                    }
                }

                if (tnz.type == "Wrapper") {
                    const wrapper = tnz as Wrapper
                    debug.log("@start - Wrapper", this.strip(wrapper))
                    debug.lpp("tokens", tokens.map(a => a.raw))
                    debug.lpp("stack", stack.children.map(a => a.name), wrapper.index)
                    debug.push()
                    wrapper.update()
                    for (; !wrapper.ended; wrapper.next()) {
                        const child = wrapper.get()
                        debug.log(child.name, '- type', child.type)
                        if (child.type == "Reader") {
                            debug.lpp("test", child.test(this))
                            if (child.test(this)) {
                                const result = child.read(this)
                                wrapper.status = "succeed"
                                if (!child.options.ignore) {
                                    tokens.push(result)
                                }
                                if (child.options.mode == 'push') {
                                    const clone = child.options.tokenizer.clone()
                                    clone.parent = wrapper
                                    stack.push(clone);
                                    this.add_merger(tokens, clone)
                                    debug.push("push", clone.name)
                                    push_stack++
                                    break
                                }
                                if (child.options.mode == 'pop') {
                                    if (wrapper.parent) {
                                        if (is_pack(wrapper.parent)) {
                                            const parent = wrapper.parent as Pack
                                            parent.status = wrapper.status
                                            parent.next()
                                        }
                                    }
                                    stack.pop();
                                    debug.pop('@pop - Wrapper', this.strip(wrapper))
                                    if (push_stack - 1 < 0) {
                                        throw new Error(`No stack to pop ${this.strip(child)}`)
                                    }
                                    push_stack--
                                    break
                                }
                            } else if (child.options.nullable == false && wrapper.options.nullable == false) {
                                if (wrapper.status == "succeed") {
                                    throw new Error(`No viable alternative.\n${this.source.pan([-100, 1], true)}<- is not ${child.name}`)
                                }
                                if (wrapper.parent) {
                                    const parent = wrapper.parent as Pack
                                    parent.status = "fail"
                                    parent.next()
                                    stack.pop()
                                    debug.pop('@pop - Wrapper', this.strip(wrapper))
                                    break
                                } else {
                                    debug.pop('@end - Wrapper', this.strip(wrapper))
                                    this.source.pop()
                                    return false
                                }
                            } else if (wrapper.options.nullable == true) {
                                wrapper.status = "succeed"
                                if (wrapper.parent) {
                                    const parent = wrapper.parent as Pack
                                    parent.status = "succeed"
                                }
                                stack.pop();
                                debug.pop('@end - Wrapper', this.strip(wrapper))
                                break
                            }
                        }
                        if (is_pack(child)) {
                            const clone = child.clone()
                            clone.parent = wrapper
                            stack.push(clone);
                            this.add_merger(tokens, clone)
                            debug.push("push", child.name)
                            break
                        }
                    }
                    if (wrapper.ended) {
                        if (wrapper.parent) {
                            if (is_pack(wrapper.parent)) {
                                const parent = wrapper.parent as Pack
                                parent.next()
                            }
                        }
                        stack.pop()
                        debug.pop('@end - Wrapper', this.strip(wrapper))
                    }
                    debug.pop()
                }

                if (tnz.type == "Group") {
                    const group = tnz as Group
                    debug.log("@start - Group", this.strip(group))
                    debug.lpp("tokens", tokens.map(a => a.raw))
                    debug.lpp("stack", stack.children.map(a => a.name), group.index)
                    debug.push()
                    group.update()
                    for (; !group.ended; group.next()) {
                        const child = group.get()
                        debug.log(child.name, '- type', child.type)
                        if (child.type == "Reader") {
                            debug.lpp("test", child.test(this))
                            if (child.test(this)) {
                                const result = child.read(this)
                                group.status = "succeed"
                                group.ended = true
                                if (!child.options.ignore) {
                                    tokens.push(result)
                                }
                                if (child.options.mode == 'push') {
                                    const clone = child.options.tokenizer.clone()
                                    clone.parent = group
                                    stack.push(clone);
                                    this.add_merger(tokens, clone)
                                    debug.push("push", clone.name)
                                    break
                                }
                                if (child.options.mode == 'pop') {
                                    if (group.parent) {
                                        if (is_pack(group.parent)) {
                                            const parent = group.parent as Pack
                                            parent.status = group.status
                                            parent.next()
                                        }
                                    }
                                    stack.pop();
                                    debug.pop('@pop - Group', this.strip(group))
                                    break
                                }
                                break
                            } else if (child.options.nullable == true) {
                                group.status = "succeed"
                                group.ended = true
                                break
                            }
                        }
                        if (is_pack(child)) {
                            const clone = child.clone()
                            clone.parent = group
                            stack.push(clone);
                            this.add_merger(tokens, clone)
                            debug.push("push", child.name)
                            break
                        }
                        group.status = "fail"
                    }
                    if (group.status == "fail" && group.options.nullable == false) {
                        if (stack.step > stack.children.length * 0.7) {
                            throw new Error(`No viable alternative.\n${this.source.pan([-100, 1], true)}<- is not ${group.name}`)
                        }
                        this.source.pop()
                        return false
                    }
                    if (group.ended == true) {
                        if (group.parent) {
                            if (is_pack(group.parent)) {
                                const parent = group.parent as Pack
                                parent.status = group.status
                                parent.next()
                            }
                        }
                        stack.pop()
                        debug.pop('@end - Group', this.strip(group))
                    }
                    debug.pop()
                }

                if (tnz.type == "GroupSerial") {
                    const group = tnz as Group
                    debug.log("@start - GroupSerial", this.strip(group))
                    debug.lpp("tokens", tokens.map(a => a.raw))
                    debug.lpp("stack", stack.children.map(a => a.name), group.index)
                    debug.push()
                    group.update()
                    for (; !group.ended; group.next()) {
                        const child = group.get()
                        debug.log(child.name, '- type', child.type)
                        if (child.type == "Reader") {
                            debug.lpp("test", child.test(this))
                            if (child.test(this)) {
                                const result = child.read(this)
                                group.status = "succeed"
                                group.ended = true
                                if (!child.options.ignore) {
                                    tokens.push(result)
                                }
                                if (child.options.mode == 'push') {
                                    const clone = child.options.tokenizer.clone()
                                    clone.parent = group
                                    stack.push(clone);
                                    this.add_merger(tokens, clone)
                                    debug.push("push", clone.name)
                                    break
                                }
                                if (child.options.mode == 'pop') {
                                    if (group.parent) {
                                        if (is_pack(group.parent)) {
                                            const parent = group.parent as Pack
                                            parent.status = group.status
                                            parent.next()
                                        }
                                    }
                                    stack.pop();
                                    debug.pop('@pop - GroupSerial', this.strip(group))
                                    break
                                }
                                break
                            }
                        }
                        if (is_pack(child)) {
                            const clone = child.clone()
                            clone.parent = group
                            stack.push(clone);
                            this.add_merger(tokens, clone)
                            debug.push("push", child.name)
                            break
                        }
                        group.status = "fail"
                    }
                    if (group.status == "fail" && group.options.nullable == false) {
                        if (stack.step > stack.children.length * 0.7) {
                            throw new Error(`No viable alternative.\n${this.source.pan([-100, 1], true)}<- is not ${group.name}`)
                        }
                        this.source.pop()
                        return false
                    }
                    if (group.ended == true) {
                        const clone = group.clone()
                        if (group.parent) {
                            if (is_pack(group.parent)) {
                                const parent = group.parent as Pack
                                parent.status = group.status
                                parent.next()
                            }
                        }
                        stack.pop()
                        debug.pop('@end - GroupSerial', this.strip(group))
                        if (group.status == "succeed") {
                            stack.push(clone);
                            this.add_merger(tokens, clone)
                            debug.push("push", clone.name)
                        }
                    }
                    debug.pop()
                }

                if (is_pack(tnz)) {
                    const _ = (tnz as Pack)
                    if (_.merging == true && _.ended == true) {
                        _.merge(tokens)
                    }
                }
            }

            stack.wreak_havoc()
        }
        return { tokens, state: this.source.pop() };
    }
}