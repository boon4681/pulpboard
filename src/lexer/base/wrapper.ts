import { is_pack, Lexer, Pack, Token, Wrapper } from "../../tokenizer"
import { DepthDebug } from "../debug"
import { Stacker } from "../stacker"


export function wrapper(lexer: Lexer, tokens: Token<any>[], stack: Stacker, debug: DepthDebug, tnz: Wrapper) {
    const wrapper = tnz as Wrapper
    wrapper.update()
    debug.log('@start -', wrapper.type, wrapper.name)
    for (; !wrapper.ended; wrapper.next()) {
        const child = wrapper.get()
        debug.lpp(child.name, '- type', child.type)
        if (child.type == "Reader") {
            debug.lpp(child.test(lexer))
            if (child.test(lexer)) {
                const result = child.read(lexer)
                wrapper.status = "succeed"
                if (!child.options.ignore) {
                    tokens.push(result)
                }
                if (child.options.mode == 'push') {
                    const clone = child.options.tokenizer.clone()
                    clone.parent = wrapper
                    stack.push(clone);
                    (lexer as any).add_merger(tokens, clone)
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
                    stack.pop('@pop -', wrapper.type, wrapper.name);
                    break
                }
            } else if (child.options.nullable == false && wrapper.options.nullable == false) {
                if (wrapper.status == "succeed") {
                    throw new Error(`No viable alternative.\n${lexer.source.pan([-100, 1], true)}<- is not ${child.name}`)
                }
                if (wrapper.parent) {
                    if(wrapper.index > 1){
                        throw new Error(`No viable alternative.\n${lexer.source.pan([-100, 1], true)}<- is not ${child.name}`)
                    }
                    const parent = wrapper.parent as Pack
                    parent.status = "fail"
                    parent.next()
                    stack.pop('@pop -', wrapper.type, wrapper.name)
                    break
                } else {
                    lexer.source.pop()
                    return false
                }
            } else if (wrapper.options.nullable) {
                wrapper.status = "succeed"
                if (wrapper.parent) {
                    const parent = wrapper.parent as Pack
                    parent.status = "succeed"
                    parent.next()
                }
                stack.pop('@pop -', wrapper.type, wrapper.name);
                break
            }
        }
        if (is_pack(child)) {
            const clone = child.clone()
            clone.parent = wrapper
            stack.push(clone);
            (lexer as any).add_merger(tokens, clone)
            break
        }
    }
    if (wrapper.ended) {
        if (wrapper.parent) {
            if (is_pack(wrapper.parent)) {
                const parent = wrapper.parent as Pack
                parent.status = wrapper.status
                parent.next()
            }
        }
        stack.pop('@pop -', wrapper.type, wrapper.name)
    }
}