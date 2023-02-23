import { IFWrapper, is_pack, Lexer, Pack, Token } from "../../tokenizer"
import { DepthDebug } from "../debug"
import { Stacker } from "../stacker"


export function ifwrapper(lexer: Lexer, tokens: Token<any>[], stack: Stacker, debug: DepthDebug, tnz: IFWrapper) {
    const ifwrapper = tnz as IFWrapper
    debug.log('@start -', ifwrapper.type, ifwrapper.name)
    if (ifwrapper.test(lexer)) {
        ifwrapper.update()
        for (; !ifwrapper.ended; ifwrapper.next()) {
            const child = ifwrapper.get()
            if (child.type == "Reader") {
                if (child.test(lexer)) {
                    const result = child.read(lexer)
                    ifwrapper.status = "succeed"
                    if (!child.options.ignore) {
                        tokens.push(result)
                    }
                    if (child.options.mode == 'push') {
                        const clone = child.options.tokenizer.clone()
                        clone.parent = ifwrapper
                        stack.push(clone);
                        (lexer as any).add_merger(tokens, clone)
                        break
                    }
                    if (child.options.mode == 'pop') {
                        if (ifwrapper.parent) {
                            if (is_pack(ifwrapper.parent)) {
                                const parent = ifwrapper.parent as Pack
                                parent.status = ifwrapper.status
                                parent.next()
                            }
                        }
                        stack.pop('@pop -', ifwrapper.type, ifwrapper.name);
                        break
                    }
                } else if (child.options.nullable == false && ifwrapper.options.nullable == false) {
                    if (ifwrapper.status == "succeed") {
                        throw new Error(`No viable alternative.\n${lexer.source.pan([-100, 1], true)}<- is not ${child.name}`)
                    }
                    if (ifwrapper.parent) {
                        if(ifwrapper.index > 1){
                            throw new Error(`No viable alternative.\n${lexer.source.pan([-100, 1], true)}<- is not ${child.name}`)
                        }
                        const parent = ifwrapper.parent as Pack
                        parent.status = "fail"
                        parent.next()
                        stack.pop('@pop -', ifwrapper.type, ifwrapper.name)
                        break
                    } else {
                        lexer.source.pop()
                        return false
                    }
                } else if (ifwrapper.options.nullable) {
                    ifwrapper.status = "succeed"
                    if (ifwrapper.parent) {
                        const parent = ifwrapper.parent as Pack
                        parent.status = "succeed"
                    }
                    stack.pop('@pop -', ifwrapper.type, ifwrapper.name);
                    break
                }
            }
            if (is_pack(child)) {
                const clone = child.clone()
                clone.parent = ifwrapper
                stack.push(clone);
                (lexer as any).add_merger(tokens, clone)
                break
            }
        }
        if (ifwrapper.ended) {
            if (ifwrapper.parent) {
                if (is_pack(ifwrapper.parent)) {
                    const parent = ifwrapper.parent as Pack
                    if(ifwrapper.stop_reading){
                        parent.ended = true
                    }else{
                        parent.next()
                    }
                }
            }
            stack.pop('@pop -', ifwrapper.type, ifwrapper.name)
        }
    } else {
        if (ifwrapper.parent) {
            if (is_pack(ifwrapper.parent)) {
                const parent = ifwrapper.parent as Pack
                parent.status = ifwrapper.status
                if (ifwrapper.stop_reading && ifwrapper.status == "succeed") {
                    parent.ended = true
                }else{
                    parent.next()
                }
            }
        }
        stack.pop('@pop -', ifwrapper.type, ifwrapper.name)
    }
}