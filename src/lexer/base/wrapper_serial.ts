import { is_pack, Lexer, Pack, Token, WrapperSerial } from "../../tokenizer"
import { DepthDebug } from "../debug"
import { Stacker } from "../stacker"


export function wrapper_serial(lexer: Lexer, tokens: Token<any>[], stack: Stacker, debug: DepthDebug, tnz: WrapperSerial) {
    const wrapper = tnz as WrapperSerial
    wrapper.update()
    debug.log('@start -', wrapper.type, wrapper.name)
    // debug.log(tokens.map(a=>a.raw))
    for (; !wrapper.ended; wrapper.next()) {
        const child = wrapper.get()
        if (child.type == "Reader") {
            if (child.test(lexer)) {
                const result = child.read(lexer)
                wrapper.status = "succeed"
                lexer.source.wreak_havoc({
                    err: new Error(`${lexer.source.pan([-100, 0], true)}<- Zero size token leaded to endless loop "${wrapper.name} > ${child.name}"`)
                })
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
                    const parent = wrapper.parent as Pack
                    parent.status = "fail"
                    parent.next()
                    stack.pop('@pop -', wrapper.type, wrapper.name)
                    break
                } else {
                    lexer.source.pop()
                    return false
                }
            } else if (child.options.nullable) {
                wrapper.status = "succeed"
                if (wrapper.parent) {
                    const parent = wrapper.parent as Pack
                    parent.status = "succeed"
                    parent.next()
                }
                stack.pop('@pop -', wrapper.type, wrapper.name)
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
        const clone = wrapper.clone()
        clone.parent = wrapper
        if (wrapper.parent) {
            if (is_pack(wrapper.parent)) {
                const parent = wrapper.parent as Pack
                if (parent.type == "WrapperSerial") {
                    parent.ended = true;
                }
                parent.status = wrapper.status
                parent.next()
            }
        }
        if (wrapper.status == "succeed") {
            stack.push(clone);
            (lexer as any).add_merger(tokens, clone)
        } else {
            stack.pop('@pop -', wrapper.type, wrapper.name)
        }
    }
}